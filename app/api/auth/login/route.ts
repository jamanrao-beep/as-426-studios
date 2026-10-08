import { NextResponse } from "next/server";
import { authenticate, encodeSession, AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, any>;
    const { email, password } = body || {};

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Please enter both email and password." },
        { status: 400 }
      );
    }

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "127.0.0.1";

    const result = await authenticate(email, password, clientIp);
    if (!result.user) {
      const status = result.rateLimited ? 429 : 401;
      return NextResponse.json(
        { error: result.error || "Invalid email or password." },
        { status }
      );
    }

    const user = result.user;
    const token = encodeSession(user);

    const response = NextResponse.json({
      success: true,
      mustChangePassword: !!user.mustChangePassword,
      user: {
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        restaurantId: user.restaurantId,
      },
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error("Login route error:", err);
    return NextResponse.json(
      { error: "Authentication failed. Please try again." },
      { status: 500 }
    );
  }
}

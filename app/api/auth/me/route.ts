import { NextResponse } from "next/server";
import { resolveAuth } from "@/lib/auth";
import { signedOutMessage } from "@/lib/auth-messages";
import { db } from "@/db/store";

export const dynamic = "force-dynamic";

// Who is signed in? Used by the mobile app to validate a stored session on launch.
export async function GET() {
  try {
    const { user, reason } = await resolveAuth();
    if (!user) {
      if (reason === "unavailable") return NextResponse.json({ error: "Could not verify your session.", code: reason }, { status: 503 });
      return NextResponse.json({ error: signedOutMessage(reason), code: reason }, { status: 401 });
    }

    let restaurantName = "";
    if (user.restaurantId) {
      const r = await db()
        .prepare("SELECT name FROM restaurants WHERE id = ?")
        .bind(user.restaurantId)
        .first<{ name: string }>();
      restaurantName = r?.name || "";
    }

    return NextResponse.json(
      {
        user: {
          userId: user.userId,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          restaurantId: user.restaurantId,
          restaurantName,
          mustChangePassword: !!user.mustChangePassword,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/auth/me error:", err);
    return NextResponse.json({ error: "Couldn’t verify your session." }, { status: 503 });
  }
}

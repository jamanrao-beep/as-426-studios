import { NextResponse } from "next/server";
import { sameOrigin } from "@/db/store";
import { encodeSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createGuest, GUEST_HOURS } from "@/lib/saas";

export const dynamic = "force-dynamic";

// "Test as guest": a sandbox restaurant that disappears after 24 hours. The app gets a session straight away.
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`guest:${ip}`, 6, 60 * 60 * 1000).allowed) {
      return NextResponse.json({ error: "Too many guest sessions from this device. Please try again later." }, { status: 429 });
    }
    const g = await createGuest();
    const token = encodeSession({
      userId: "acc_g_" + g.restaurantId.replace("guest-", ""),
      email: g.email,
      displayName: "Guest Manager",
      role: "admin",
      restaurantId: g.restaurantId,
      mustChangePassword: false,
      sessionVersion: 1,
    });
    return NextResponse.json({ token, expiresAt: g.expires, hours: GUEST_HOURS });
  } catch (err) {
    console.error("POST /api/guest error:", err);
    return NextResponse.json({ error: "Could not start a guest session. Please try again." }, { status: 503 });
  }
}

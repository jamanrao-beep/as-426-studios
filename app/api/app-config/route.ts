import { NextResponse } from "next/server";
import { resolveAuth } from "@/lib/auth";
import { readGlobalControls, readRestaurantControls } from "@/lib/app-controls";
import { db } from "@/db/store";
import { getSubscription, isGuestEmail } from "@/lib/saas";

export const dynamic = "force-dynamic";

// What the signed-in person's app may do right now. Set by the Super Admin on the website.
export async function GET() {
  try {
    const { user, reason } = await resolveAuth();
    if (!user) {
      if (reason === "unavailable") return NextResponse.json({ error: "Could not load app settings.", code: reason }, { status: 503 });
      return NextResponse.json({ error: "Please sign in.", code: reason }, { status: 401 });
    }
    const global = await readGlobalControls();
    const restaurant = user.restaurantId ? await readRestaurantControls(user.restaurantId) : null;
    const guest = await isGuestEmail(user.email);
    const subscription = user.restaurantId && !guest ? await getSubscription(user.restaurantId) : null;
    let guestExpiresAt: string | null = null;
    if (guest) {
      const g = await db().prepare("SELECT expires_at FROM guest_accounts WHERE LOWER(email) = ?").bind(user.email.toLowerCase()).first<{ expires_at: string }>();
      guestExpiresAt = g?.expires_at || null;
    }
    return NextResponse.json({ global, restaurant, guest, guestExpiresAt, subscription }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/app-config error:", err);
    return NextResponse.json({ error: "Could not load app settings." }, { status: 503 });
  }
}

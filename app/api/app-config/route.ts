import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { readGlobalControls, readRestaurantControls } from "@/lib/app-controls";
import { getSubscription, isGuestEmail } from "@/lib/saas";

export const dynamic = "force-dynamic";

// What the signed-in person's app may do right now. Set by the Super Admin on the website.
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const global = await readGlobalControls();
    const restaurant = user.restaurantId ? await readRestaurantControls(user.restaurantId) : null;
    const guest = await isGuestEmail(user.email);
    const subscription = user.restaurantId && !guest ? await getSubscription(user.restaurantId) : null;
    return NextResponse.json({ global, restaurant, guest, subscription }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/app-config error:", err);
    return NextResponse.json({ error: "Could not load app settings." }, { status: 503 });
  }
}

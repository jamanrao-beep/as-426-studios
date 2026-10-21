import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { db, sameOrigin } from "@/db/store";
import { ensureSaasTables, getSubscription, isGuestEmail, PLANS, TRIAL_DAYS } from "@/lib/saas";

export const dynamic = "force-dynamic";

// The signed-in restaurant's plan, trial countdown and the price list.
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const guest = await isGuestEmail(user.email);
    const sub = user.restaurantId ? await getSubscription(user.restaurantId) : null;
    return NextResponse.json(
      { guest, subscription: guest ? null : sub, plans: PLANS, trialDays: TRIAL_DAYS },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/subscription error:", err);
    return NextResponse.json({ error: "Could not load your plan." }, { status: 503 });
  }
}

// A manager picks a plan. The Super Admin sees the request and activates it once payment is received.
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const user = await getAuthUser();
    if (!user || user.role !== "admin" || !user.restaurantId) {
      return NextResponse.json({ error: "Only the restaurant manager can choose a plan." }, { status: 403 });
    }
    if (await isGuestEmail(user.email)) {
      return NextResponse.json({ error: "Register your restaurant to choose a plan." }, { status: 403 });
    }
    const p = z.object({ plan: z.enum(["monthly", "half_yearly", "yearly"]) }).safeParse(await req.json());
    if (!p.success) return NextResponse.json({ error: "Choose a plan." }, { status: 400 });
    await ensureSaasTables();
    const now = new Date().toISOString();
    const exists = await db().prepare("SELECT restaurant_id FROM subscriptions WHERE restaurant_id = ?").bind(user.restaurantId).first();
    if (exists) {
      await db()
        .prepare("UPDATE subscriptions SET requested_plan = ?, requested_at = ?, updated_at = ? WHERE restaurant_id = ?")
        .bind(p.data.plan, now, now, user.restaurantId)
        .run();
    } else {
      await db()
        .prepare("INSERT INTO subscriptions (restaurant_id, status, requested_plan, requested_at, updated_at) VALUES (?, 'expired', ?, ?, ?)")
        .bind(user.restaurantId, p.data.plan, now, now)
        .run();
    }
    return NextResponse.json({ ok: true, plan: p.data.plan });
  } catch (err) {
    console.error("POST /api/subscription error:", err);
    return NextResponse.json({ error: "Could not send your plan request." }, { status: 503 });
  }
}

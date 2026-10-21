import { NextResponse } from "next/server";
import { z } from "zod";
import { access, db, sameOrigin, validSlug } from "@/db/store";
import { logAudit } from "@/lib/audit";
import { ensureSaasTables, getPlan, getSubscription, listPlans, startTrial } from "@/lib/saas";

export const dynamic = "force-dynamic";

// Super Admin: every restaurant's plan, trial countdown and any plan the manager asked for.
export async function GET() {
  try {
    const a = await access();
    if (!a.owner) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    await ensureSaasTables();
    const restaurants = await db()
      .prepare("SELECT id, name FROM restaurants WHERE status != 'archived' ORDER BY name")
      .all<{ id: string; name: string }>();
    const guests = await db().prepare("SELECT restaurant_id FROM guest_accounts").all<{ restaurant_id: string }>();
    const guestIds = new Set(guests.results.map((g) => g.restaurant_id));
    const rows = await Promise.all(
      restaurants.results
        .filter((r) => !guestIds.has(r.id))
        .map(async (r) => ({ id: r.id, name: r.name, ...(await getSubscription(r.id)) }))
    );
    return NextResponse.json({ subscriptions: rows, plans: await listPlans() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/admin/subscriptions error:", err);
    return NextResponse.json({ error: "Could not load plans." }, { status: 503 });
  }
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("activate"), restaurant: z.string().refine(validSlug), plan: z.string().min(2).max(16) }),
  z.object({ action: z.literal("start_trial"), restaurant: z.string().refine(validSlug), days: z.number().int().min(1).max(90) }),
  z.object({ action: z.literal("expire"), restaurant: z.string().refine(validSlug) }),
]);

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const a = await access();
    if (!a.owner) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const p = schema.safeParse(await req.json());
    if (!p.success) return NextResponse.json({ error: "Please check the details." }, { status: 400 });
    await ensureSaasTables();
    const d = p.data;
    const exists = await db().prepare("SELECT id FROM restaurants WHERE id = ?").bind(d.restaurant).first();
    if (!exists) return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
    const now = new Date();

    if (d.action === "start_trial") {
      await startTrial(d.restaurant, a.email, d.days);
    } else if (d.action === "expire") {
      await db()
        .prepare("UPDATE subscriptions SET status = 'expired', trial_ends_at = ?, period_end = ?, updated_at = ?, updated_by = ? WHERE restaurant_id = ?")
        .bind(now.toISOString(), now.toISOString(), now.toISOString(), a.email, d.restaurant)
        .run();
    } else {
      const chosen = await getPlan(d.plan);
      if (!chosen) return NextResponse.json({ error: "That plan no longer exists." }, { status: 404 });
      const months = chosen.months;
      const current = await getSubscription(d.restaurant);
      // Paying early adds to the time left instead of losing it.
      const base = current.status === "active" && current.endsAt ? new Date(current.endsAt) : now;
      const end = new Date(base);
      end.setMonth(end.getMonth() + months);
      const have = await db().prepare("SELECT restaurant_id FROM subscriptions WHERE restaurant_id = ?").bind(d.restaurant).first();
      if (have) {
        await db()
          .prepare("UPDATE subscriptions SET status = 'active', plan = ?, period_end = ?, requested_plan = NULL, requested_at = NULL, updated_at = ?, updated_by = ? WHERE restaurant_id = ?")
          .bind(d.plan, end.toISOString(), now.toISOString(), a.email, d.restaurant)
          .run();
      } else {
        await db()
          .prepare("INSERT INTO subscriptions (restaurant_id, status, plan, period_end, updated_at, updated_by) VALUES (?, 'active', ?, ?, ?, ?)")
          .bind(d.restaurant, d.plan, end.toISOString(), now.toISOString(), a.email)
          .run();
      }
    }
    await logAudit({ action: "subscription_updated", actorEmail: a.email, actorRole: a.role, targetType: "restaurant", targetId: d.restaurant, details: { change: d.action } });
    return NextResponse.json({ ok: true, subscription: await getSubscription(d.restaurant) });
  } catch (err) {
    console.error("POST /api/admin/subscriptions error:", err);
    return NextResponse.json({ error: "Could not update the plan." }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { access, db, sameOrigin } from "@/db/store";
import { logAudit } from "@/lib/audit";
import { ensureSaasTables, getPlan, listPlans } from "@/lib/saas";

export const dynamic = "force-dynamic";

// Super Admin: the whole price list, including plans that are switched off.
export async function GET() {
  try {
    const a = await access();
    if (!a.owner) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const plans = await listPlans();
    const usage = await db()
      .prepare(
        `SELECT p.plan_key AS plan_key,
           (SELECT COUNT(*) FROM subscriptions s WHERE s.plan = p.plan_key OR s.requested_plan = p.plan_key) AS subs,
           (SELECT COUNT(*) FROM registration_requests r WHERE r.plan_choice = p.plan_key AND r.status = 'pending') AS pending
         FROM plans p`
      )
      .all<{ plan_key: string; subs: number; pending: number }>();
    const used = new Map(usage.results.map((u) => [u.plan_key, Number(u.subs) + Number(u.pending)]));
    return NextResponse.json({ plans: plans.map((p) => ({ ...p, inUse: used.get(p.key) || 0 })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/admin/plans error:", err);
    return NextResponse.json({ error: "Could not load the plans." }, { status: 503 });
  }
}

const planFields = {
  label: z.string().trim().min(2, "Give the plan a name.").max(40),
  price: z.number().int("Price must be a whole number.").min(0).max(10000000),
  strike: z.number().int().min(0).max(10000000),
  months: z.number().int("Months must be a whole number.").min(1).max(120),
  blurb: z.string().trim().max(160).default(""),
  best: z.boolean().default(false),
  active: z.boolean().default(true),
  sort: z.number().int().min(0).max(999).default(50),
};

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), ...planFields }),
  z.object({ action: z.literal("update"), key: z.string().min(2).max(16), ...planFields }),
  z.object({ action: z.literal("delete"), key: z.string().min(2).max(16) }),
]);

const slug = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 14) || "plan";

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const a = await access();
    if (!a.owner) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const p = schema.safeParse(await req.json());
    if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message || "Please check the plan details." }, { status: 400 });
    await ensureSaasTables();
    const d = p.data;
    const now = new Date().toISOString();

    if (d.action === "delete") {
      const inUse = await db()
        .prepare(
          "SELECT (SELECT COUNT(*) FROM subscriptions WHERE plan = ? OR requested_plan = ?) + (SELECT COUNT(*) FROM registration_requests WHERE plan_choice = ?) AS n"
        )
        .bind(d.key, d.key, d.key)
        .first<{ n: number }>();
      if (Number(inUse?.n || 0) > 0) {
        return NextResponse.json({ error: "Restaurants are using this plan. Switch it off instead, so it stays on their records but nobody can pick it." }, { status: 409 });
      }
      await db().prepare("DELETE FROM plans WHERE plan_key = ?").bind(d.key).run();
      await logAudit({ action: "plan_deleted", actorEmail: a.email, actorRole: a.role, targetType: "plan", targetId: d.key, details: {} });
      return NextResponse.json({ ok: true });
    }

    if (d.strike && d.strike < d.price) return NextResponse.json({ error: "The crossed-out price should be higher than the price." }, { status: 400 });
    const strike = d.strike || d.price;

    // Only one plan carries the Best value badge.
    if (d.best) await db().prepare("UPDATE plans SET best = 0").run();

    if (d.action === "create") {
      let key = slug(d.label);
      let n = 2;
      while (await getPlan(key)) key = slug(d.label).slice(0, 12) + "_" + n++;
      await db()
        .prepare("INSERT INTO plans (plan_key, label, price, strike, months, blurb, best, active, sort, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(key, d.label, d.price, strike, d.months, d.blurb, d.best ? 1 : 0, d.active ? 1 : 0, d.sort, now)
        .run();
      await logAudit({ action: "plan_created", actorEmail: a.email, actorRole: a.role, targetType: "plan", targetId: key, details: { price: d.price, months: d.months } });
      return NextResponse.json({ ok: true, key });
    }

    const exists = await getPlan(d.key);
    if (!exists) return NextResponse.json({ error: "That plan no longer exists." }, { status: 404 });
    await db()
      .prepare("UPDATE plans SET label = ?, price = ?, strike = ?, months = ?, blurb = ?, best = ?, active = ?, sort = ?, updated_at = ? WHERE plan_key = ?")
      .bind(d.label, d.price, strike, d.months, d.blurb, d.best ? 1 : 0, d.active ? 1 : 0, d.sort, now, d.key)
      .run();
    await logAudit({ action: "plan_updated", actorEmail: a.email, actorRole: a.role, targetType: "plan", targetId: d.key, details: { price: d.price, active: d.active } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/admin/plans error:", err);
    return NextResponse.json({ error: "Could not save the plan." }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { access, db, denied, sameOrigin } from "@/db/store";
import { logAudit } from "@/lib/audit";
import { fail, readJson } from "@/lib/http";
import { deleteRestaurantData, ensureSaasTables, getSubscription } from "@/lib/saas";

export const dynamic = "force-dynamic";

type Owner = {
  restaurant_id: string;
  restaurant_name: string;
  login: string;
  name: string | null;
  contact_email: string | null;
  phone: string | null;
  created_at: string | null;
};

// Super Admin: everyone who uses Table Secret, in one place. Each owner shows their contact details, whether the free
// trial was used, the plan and how much of it is used up, and how busy the restaurant is. Guests show whether their
// free week was used. The buttons that act on this (give a trial again, allow a guest again) live in the POST below.
export async function GET() {
  try {
    const a = await access();
    if (!a.owner) return denied(a, "Super Admin access required.");
    await ensureSaasTables();
    const database = db();

    const guestRows = await database
      .prepare("SELECT email, restaurant_id, created_at, expires_at, contact_email, contact_name, contact_phone FROM guest_accounts")
      .all<{ email: string; restaurant_id: string; created_at: string; expires_at: string; contact_email: string | null; contact_name: string | null; contact_phone: string | null }>();
    const guestRestaurants = new Set(guestRows.results.map((g) => g.restaurant_id));

    // One row per manager login, with the contact details they gave when they applied.
    const owners = await database
      .prepare(
        `SELECT a.restaurant_id, r.name AS restaurant_name, a.email AS login, a.name, a.created_at,
                COALESCE(q.contact_email, r.contact_email) AS contact_email, COALESCE(q.phone, r.contact_phone) AS phone
         FROM accounts a
         JOIN restaurants r ON r.id = a.restaurant_id
         LEFT JOIN registration_requests q ON LOWER(q.email) = LOWER(a.email) AND q.status = 'approved'
         WHERE a.role = 'admin' AND r.status != 'archived'
         ORDER BY a.created_at DESC`
      )
      .all<Owner>();
    const real = owners.results.filter((o) => !guestRestaurants.has(o.restaurant_id));

    const ids = [...new Set(real.map((o) => o.restaurant_id))];
    const [orderCounts, waiterCounts, menus, payments] = await Promise.all([
      database.prepare("SELECT restaurant_id, COUNT(*) AS n FROM orders WHERE is_test = 0 GROUP BY restaurant_id").all<{ restaurant_id: string; n: number }>(),
      database.prepare("SELECT restaurant_id, COUNT(*) AS n FROM accounts WHERE role = 'waiter' GROUP BY restaurant_id").all<{ restaurant_id: string; n: number }>(),
      database.prepare("SELECT id, data FROM menu").all<{ id: string; data: string }>(),
      database.prepare("SELECT restaurant_id, SUM(amount) AS paid FROM payments WHERE status = 'paid' GROUP BY restaurant_id").all<{ restaurant_id: string; paid: number }>(),
    ]);
    const orderMap = new Map(orderCounts.results.map((r) => [r.restaurant_id, Number(r.n)]));
    const waiterMap = new Map(waiterCounts.results.map((r) => [r.restaurant_id, Number(r.n)]));
    const paidMap = new Map(payments.results.map((r) => [r.restaurant_id, Number(r.paid)]));
    const dishMap = new Map<string, number>();
    for (const m of menus.results) {
      try {
        dishMap.set(m.id, (JSON.parse(m.data)?.dishes || []).length);
      } catch {
        dishMap.set(m.id, 0);
      }
    }
    const subs = new Map(await Promise.all(ids.map(async (id) => [id, await getSubscription(id)] as const)));
    const subRows = await database.prepare("SELECT restaurant_id, trial_ends_at, plan, period_end FROM subscriptions").all<{ restaurant_id: string; trial_ends_at: string | null; plan: string | null; period_end: string | null }>();
    const trialRow = new Map(subRows.results.map((r) => [r.restaurant_id, r]));

    const restaurants = real.map((o) => {
      const s = subs.get(o.restaurant_id)!;
      const t = trialRow.get(o.restaurant_id);
      return {
        restaurantId: o.restaurant_id,
        restaurant: o.restaurant_name,
        login: o.login,
        name: o.name,
        contactEmail: o.contact_email,
        phone: o.phone,
        since: o.created_at,
        // "Trial used" means a trial was ever started for this restaurant, whether it is still running or over.
        trial: { used: !!t?.trial_ends_at, endsAt: t?.trial_ends_at || null, running: s.status === "trial" },
        plan: { status: s.status, plan: s.plan, endsAt: s.endsAt, msLeft: s.msLeft },
        paidPaise: paidMap.get(o.restaurant_id) || 0,
        usage: { orders: orderMap.get(o.restaurant_id) || 0, dishes: dishMap.get(o.restaurant_id) || 0, waiters: waiterMap.get(o.restaurant_id) || 0 },
      };
    });

    const used = await database.prepare("SELECT email, first_at FROM guest_used ORDER BY first_at DESC").all<{ email: string; first_at: string }>();
    const now = new Date().toISOString();
    const activeByEmail = new Map(guestRows.results.filter((g) => g.contact_email).map((g) => [g.contact_email!.toLowerCase(), g]));
    const guests = used.results.map((u) => {
      const g = activeByEmail.get(u.email.toLowerCase());
      return {
        email: u.email,
        name: g?.contact_name || null,
        phone: g?.contact_phone || null,
        usedAt: u.first_at,
        active: !!g && g.expires_at > now,
        expiresAt: g?.expires_at || null,
      };
    });

    return NextResponse.json({ restaurants, guests }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "GET /api/admin/people", "Could not load people.");
  }
}

const schema = z.discriminatedUnion("action", [
  // Let a guest try the sandbox again (clears the "used" mark and removes any sandbox still there).
  z.object({ action: z.literal("reset_guest"), email: z.string().trim().toLowerCase().email().max(190) }),
  // End a running guest sandbox now, keeping the "used" mark.
  z.object({ action: z.literal("end_guest"), email: z.string().trim().toLowerCase().email().max(190) }),
]);

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const a = await access();
    if (!a.owner) return denied(a, "Super Admin access required.");
    const body = await readJson(req);
    if (!body.ok) return body.res;
    const p = schema.safeParse(body.data);
    if (!p.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    await ensureSaasTables();
    const email = p.data.email;

    const g = await db().prepare("SELECT email, restaurant_id FROM guest_accounts WHERE LOWER(contact_email) = ?").bind(email).first<{ email: string; restaurant_id: string }>();
    if (g) await deleteRestaurantData(g.restaurant_id);
    if (p.data.action === "reset_guest") await db().prepare("DELETE FROM guest_used WHERE email = ?").bind(email).run();

    await logAudit({ action: "subscription_updated", actorEmail: a.email, actorRole: a.role, targetType: "guest", targetId: email, details: { change: p.data.action } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "POST /api/admin/people", "Could not save that change.");
  }
}

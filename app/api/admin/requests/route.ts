import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { access, db, sameOrigin } from "@/db/store";
import { logAudit } from "@/lib/audit";
import { ensureSaasTables, startTrial, TRIAL_DAYS, uniqueSlug } from "@/lib/saas";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  email: string;
  owner_name: string;
  phone: string;
  restaurant_name: string;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  status: string;
  note: string | null;
  restaurant_id: string | null;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
};

// Super Admin: restaurant registration requests, newest first.
export async function GET() {
  try {
    const a = await access();
    if (!a.owner) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    await ensureSaasTables();
    const rows = await db()
      .prepare(
        `SELECT id, email, owner_name, phone, restaurant_name, address, city, lat, lng, status, note, restaurant_id, created_at, decided_at, decided_by
         FROM registration_requests ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 200`
      )
      .all<Row>();
    return NextResponse.json({ requests: rows.results, trialDays: TRIAL_DAYS }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/admin/requests error:", err);
    return NextResponse.json({ error: "Could not load requests." }, { status: 503 });
  }
}

const schema = z.object({
  id: z.string().min(1).max(64),
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(300).optional(),
});

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const a = await access();
    if (!a.owner) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const p = schema.safeParse(await req.json());
    if (!p.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    await ensureSaasTables();

    const r = await db()
      .prepare(
        "SELECT id, email, password_hash, owner_name, phone, restaurant_name, address, city, lat, lng, status FROM registration_requests WHERE id = ?"
      )
      .bind(p.data.id)
      .first<Row & { password_hash: string }>();
    if (!r) return NextResponse.json({ error: "Request not found." }, { status: 404 });
    if (r.status !== "pending") return NextResponse.json({ error: "This request was already decided." }, { status: 409 });

    const now = new Date().toISOString();

    if (p.data.action === "reject") {
      await db()
        .prepare("UPDATE registration_requests SET status = 'rejected', note = ?, decided_at = ?, decided_by = ? WHERE id = ?")
        .bind(p.data.note || "", now, a.email, r.id)
        .run();
      await logAudit({ action: "registration_decided", actorEmail: a.email, actorRole: a.role, targetType: "request", targetId: r.id, details: { decision: "rejected", email: r.email } });
      return NextResponse.json({ ok: true, status: "rejected" });
    }

    const taken = await db().prepare("SELECT id FROM accounts WHERE LOWER(email) = ?").bind(r.email).first();
    if (taken) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });

    const restaurantId = await uniqueSlug(r.restaurant_name);
    await db()
      .prepare(
        "INSERT INTO restaurants (id, name, slug, address, contact_phone, contact_email, welcome_message, note, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, '', 'active', ?, ?)"
      )
      .bind(restaurantId, r.restaurant_name, restaurantId, `${r.address}, ${r.city}`, r.phone, r.email, `Welcome to ${r.restaurant_name}.`, now, now)
      .run();
    await db()
      .prepare("INSERT INTO menu (id, data, revision) VALUES (?, ?, 1)")
      .bind(restaurantId, JSON.stringify({ name: r.restaurant_name, active: true, tagline: `Welcome to ${r.restaurant_name}.`, note: "", dishes: [] }))
      .run();
    await db()
      .prepare(
        "INSERT INTO accounts (id, email, password_hash, name, role, restaurant_id, status, must_change_password, session_version, created_at, updated_at) VALUES (?, ?, ?, ?, 'admin', ?, 'active', 0, 1, ?, ?)"
      )
      .bind("acc_" + crypto.randomBytes(6).toString("hex"), r.email, r.password_hash, r.owner_name, restaurantId, now, now)
      .run();
    await db().prepare("INSERT OR IGNORE INTO restaurant_members (restaurant_id, email) VALUES (?, ?)").bind(restaurantId, r.email).run();
    if (r.lat !== null && r.lng !== null) {
      await db().prepare("INSERT INTO restaurant_locations (restaurant_id, lat, lng, city) VALUES (?, ?, ?, ?)").bind(restaurantId, r.lat, r.lng, r.city).run();
    }
    const trialEnds = await startTrial(restaurantId, a.email);
    await db()
      .prepare("UPDATE registration_requests SET status = 'approved', restaurant_id = ?, note = ?, decided_at = ?, decided_by = ? WHERE id = ?")
      .bind(restaurantId, p.data.note || "", now, a.email, r.id)
      .run();
    await logAudit({
      action: "registration_decided",
      actorEmail: a.email,
      actorRole: a.role,
      targetType: "restaurant",
      targetId: restaurantId,
      details: { decision: "approved", email: r.email, trialEnds },
    });
    return NextResponse.json({ ok: true, status: "approved", restaurantId, trialEnds });
  } catch (err) {
    console.error("POST /api/admin/requests error:", err);
    return NextResponse.json({ error: "Could not save that decision." }, { status: 503 });
  }
}

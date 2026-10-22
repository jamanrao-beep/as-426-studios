import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { access, db, sameOrigin } from "@/db/store";
import { logAudit } from "@/lib/audit";
import { createRestaurantWithOwner, deleteRestaurantData, ensureSaasTables, startTrial, TRIAL_DAYS, listPlans } from "@/lib/saas";
import { usernameOf } from "@/lib/usernames";
import { sendMail } from "@/lib/mailer";
import { approvedEmail, rejectedEmail } from "@/lib/mail-templates";

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
  contact_email: string | null;
  plan_choice: string | null;
  restaurant_code: string | null;
};

// Super Admin: restaurant registration requests, newest first.
export async function GET() {
  try {
    const a = await access();
    if (!a.owner) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    await ensureSaasTables();
    const rows = await db()
      .prepare(
        `SELECT id, email, owner_name, phone, restaurant_name, address, city, lat, lng, status, note, restaurant_id, created_at, decided_at, decided_by, contact_email, plan_choice, restaurant_code
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
        "SELECT id, email, password_hash, owner_name, phone, restaurant_name, address, city, lat, lng, status, contact_email, plan_choice, restaurant_code FROM registration_requests WHERE id = ?"
      )
      .bind(p.data.id)
      .first<Row & { password_hash: string; restaurant_code: string | null }>();
    if (!r) return NextResponse.json({ error: "Request not found." }, { status: 404 });
    if (r.status !== "pending") return NextResponse.json({ error: "This request was already decided." }, { status: 409 });

    const now = new Date().toISOString();

    if (p.data.action === "reject") {
      await db()
        .prepare("UPDATE registration_requests SET status = 'rejected', note = ?, decided_at = ?, decided_by = ? WHERE id = ?")
        .bind(p.data.note || "", now, a.email, r.id)
        .run();
      await logAudit({ action: "registration_decided", actorEmail: a.email, actorRole: a.role, targetType: "request", targetId: r.id, details: { decision: "rejected", email: r.email } });
      let mail: { sent: boolean; reason?: string } = { sent: false, reason: "No contact email on file." };
      if (r.contact_email) {
        const m = rejectedEmail({ ownerName: r.owner_name, restaurantName: r.restaurant_name, note: p.data.note });
        mail = await sendMail(r.contact_email, m.subject, m.html, m.text);
      }
      return NextResponse.json({ ok: true, status: "rejected", mail });
    }

    // Claim the request first, so two simultaneous approvals cannot both create a restaurant.
    const claim = await db().prepare("UPDATE registration_requests SET status = 'approving' WHERE id = ? AND status = 'pending'").bind(r.id).run();
    if (!claim.meta.changes) return NextResponse.json({ error: "This request was already decided." }, { status: 409 });
    const release = () => db().prepare("UPDATE registration_requests SET status = 'pending' WHERE id = ? AND status = 'approving'").bind(r.id).run().catch(() => {});

    // The login ID is built from the username they chose and the new restaurant's code, so it only exists now.
    let restaurantId = "";
    let loginEmail = "";
    let trialEnds = "";
    try {
      const created = await createRestaurantWithOwner({
        restaurantName: r.restaurant_name,
        address: r.address,
        city: r.city,
        phone: r.phone,
        contactEmail: r.contact_email || "",
        lat: r.lat,
        lng: r.lng,
        ownerName: r.owner_name,
        username: usernameOf(r.email),
        passwordHash: r.password_hash,
        mustChange: false,
        by: a.email,
        code: r.restaurant_code || undefined,
      });
      restaurantId = created.restaurantId;
      loginEmail = created.loginEmail;
      trialEnds = await startTrial(restaurantId, a.email);
      await db()
        .prepare("UPDATE registration_requests SET status = 'approved', restaurant_id = ?, email = ?, note = ?, decided_at = ?, decided_by = ? WHERE id = ?")
        .bind(restaurantId, loginEmail, p.data.note || "", now, a.email, r.id)
        .run();
      await logAudit({
        action: "registration_decided",
        actorEmail: a.email,
        actorRole: a.role,
        targetType: "restaurant",
        targetId: restaurantId,
        details: { decision: "approved", email: loginEmail, trialEnds },
      });
    } catch (e) {
      // Nothing half-built is left behind, and the request goes back to the queue.
      if (restaurantId) await deleteRestaurantData(restaurantId).catch(() => {});
      await release();
      throw e;
    }
    // Email the owner from the Table Secret address with their login id and trial date.
    let mail: { sent: boolean; reason?: string } = { sent: false, reason: "No contact email on file." };
    if (r.contact_email) {
      const planNames: Record<string, string> = Object.fromEntries((await listPlans()).map((x) => [x.key, x.label]));
      const m = approvedEmail({
        ownerName: r.owner_name,
        restaurantName: r.restaurant_name,
        loginEmail,
        restaurantCode: restaurantId,
        trialEnds,
        plan: r.plan_choice && r.plan_choice !== "trial" ? planNames[r.plan_choice] : undefined,
      });
      mail = await sendMail(r.contact_email, m.subject, m.html, m.text);
    }
    if (r.plan_choice && r.plan_choice !== "trial") {
      await db()
        .prepare("UPDATE subscriptions SET requested_plan = ?, requested_at = ? WHERE restaurant_id = ?")
        .bind(r.plan_choice, now, restaurantId)
        .run();
    }
    return NextResponse.json({ ok: true, status: "approved", restaurantId, trialEnds, mail });
  } catch (err) {
    console.error("POST /api/admin/requests error:", err);
    return NextResponse.json({ error: "Could not save that decision." }, { status: 503 });
  }
}

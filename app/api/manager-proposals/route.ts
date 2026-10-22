import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { access, db, denied, sameOrigin } from "@/db/store";
import { hashPassword, generateTemporaryPassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";
import { fail, isDuplicate, readJson, weakPassword } from "@/lib/http";
import { ensureSaasTables, isGuestEmail } from "@/lib/saas";
import { checkUsernameAt, firstInLine, staffLogin } from "@/lib/usernames";
import { checkEmailProof, EMAIL_PROOF_MESSAGE } from "@/lib/email-proof";
import { sendMail } from "@/lib/mailer";
import { managerApprovedEmail, managerRejectedEmail } from "@/lib/mail-templates";
import { rateLimitDb } from "@/lib/rate-limit-db";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  restaurant_id: string;
  restaurant_name: string | null;
  proposed_by: string;
  proposer_name: string | null;
  name: string;
  username: string;
  contact_email: string;
  phone: string | null;
  status: string;
  note: string | null;
  login_email: string | null;
  created_at: string;
  decided_at: string | null;
};


// A manager sees the proposals for their own restaurant. The Super Admin sees them all, pending first.
export async function GET() {
  try {
    const a = await access();
    if (!a.owner && !(a.allowed && a.restaurantId)) return denied(a, "Restaurant manager or Super Admin access required.");
    await ensureSaasTables();
    const cols = "p.id, p.restaurant_id, r.name AS restaurant_name, p.proposed_by, p.proposer_name, p.name, p.username, p.contact_email, p.phone, p.status, p.note, p.login_email, p.created_at, p.decided_at";
    const rows = a.owner
      ? await db().prepare(`SELECT ${cols} FROM manager_proposals p LEFT JOIN restaurants r ON r.id = p.restaurant_id ORDER BY CASE p.status WHEN 'pending' THEN 0 ELSE 1 END, p.created_at DESC LIMIT 200`).all<Row>()
      : await db().prepare(`SELECT ${cols} FROM manager_proposals p LEFT JOIN restaurants r ON r.id = p.restaurant_id WHERE p.restaurant_id = ? ORDER BY p.created_at DESC LIMIT 50`).bind(a.restaurantId!).all<Row>();
    return NextResponse.json({ proposals: rows.results, pending: rows.results.filter((x) => x.status === "pending").length }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "GET /api/manager-proposals", "Could not load manager requests.");
  }
}

const proposeSchema = z.object({
  action: z.literal("propose"),
  name: z.string().trim().min(2, "Enter the person's name.").max(120),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,29}$/, "Login name: 3 to 30 letters, numbers, dots or dashes."),
  contactEmail: z.string().trim().toLowerCase().email("Enter a valid email.").max(190),
  emailProof: z.string().max(400).optional(),
  phone: z.string().trim().max(40).optional(),
});
const decideSchema = z.object({
  action: z.enum(["approve", "reject"]),
  id: z.string().min(1).max(40),
  note: z.string().trim().max(300).optional(),
  // Optional, on approval: set their password yourself. They still choose their own at first sign-in.
  password: z.string().max(100).optional(),
});

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const body = await readJson(req);
    if (!body.ok) return body.res;
    const a = await access();
    if (!a.owner && !(a.allowed && a.restaurantId)) return denied(a, "Restaurant manager or Super Admin access required.");
    await ensureSaasTables();
    const now = new Date().toISOString();

    // A manager asks for another manager.
    if (!a.owner) {
      const p = proposeSchema.safeParse(body.data);
      if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message || "Check the details." }, { status: 400 });
      if (await isGuestEmail(a.email)) return NextResponse.json({ error: "Register your restaurant to add managers." }, { status: 403 });
      if (!(await rateLimitDb(`mgrprop:${a.email.toLowerCase()}`, 10, 24 * 3600 * 1000)).allowed) {
        return NextResponse.json({ error: "You have sent several requests today. Please try again tomorrow." }, { status: 429 });
      }
      const d = p.data;
      if (!checkEmailProof(d.contactEmail, d.emailProof)) return NextResponse.json({ error: EMAIL_PROOF_MESSAGE, needEmailCode: true }, { status: 400 });
      const loginEmail = staffLogin(d.username, a.restaurantId!);
      const name = await checkUsernameAt(d.username, a.restaurantId!);
      if (!name.ok) return NextResponse.json({ error: name.reason }, { status: name.status });
      const open = await db().prepare("SELECT COUNT(*) AS n FROM manager_proposals WHERE restaurant_id = ? AND status = 'pending'").bind(a.restaurantId!).first<{ n: number }>();
      if (Number(open?.n || 0) >= 3) return NextResponse.json({ error: "You already have 3 requests waiting. Please wait for a decision." }, { status: 429 });

      const id = "mp_" + crypto.randomUUID().slice(0, 12);
      await db()
        .prepare("INSERT INTO manager_proposals (id, restaurant_id, proposed_by, proposer_name, name, username, contact_email, phone, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)")
        .bind(id, a.restaurantId!, a.email.toLowerCase(), a.name || null, d.name, d.username, d.contactEmail, d.phone || null, now)
        .run();
      if (!(await firstInLine(d.username, a.restaurantId!, id))) {
        await db().prepare("DELETE FROM manager_proposals WHERE id = ?").bind(id).run();
        return NextResponse.json({ error: "That username was just taken at your restaurant. Please choose another." }, { status: 409 });
      }
      await logAudit({ action: "manager_proposed", actorEmail: a.email, actorRole: a.role, targetType: "manager_proposal", targetId: id, details: { username: d.username, restaurant_id: a.restaurantId } });
      return NextResponse.json({ ok: true, id, loginEmail });
    }

    // The Super Admin decides.
    const p = decideSchema.safeParse(body.data);
    if (!p.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const r = await db()
      .prepare("SELECT p.*, r.name AS restaurant_name FROM manager_proposals p LEFT JOIN restaurants r ON r.id = p.restaurant_id WHERE p.id = ?")
      .bind(p.data.id)
      .first<Row>();
    if (!r) return NextResponse.json({ error: "Request not found." }, { status: 404 });
    if (r.status !== "pending") return NextResponse.json({ error: "This request was already decided." }, { status: 409 });
    const restaurantName = r.restaurant_name || r.restaurant_id;

    if (p.data.action === "reject") {
      const claim = await db().prepare("UPDATE manager_proposals SET status = 'rejected', note = ?, decided_at = ?, decided_by = ? WHERE id = ? AND status = 'pending'").bind(p.data.note || "", now, a.email, r.id).run();
      if (!claim.meta.changes) return NextResponse.json({ error: "This request was already decided." }, { status: 409 });
      await logAudit({ action: "manager_proposal_decided", actorEmail: a.email, actorRole: a.role, targetType: "manager_proposal", targetId: r.id, details: { decision: "rejected" } });
      const m = managerRejectedEmail({ name: r.name, restaurantName, note: p.data.note });
      const mail = await sendMail(r.contact_email, m.subject, m.html, m.text);
      return NextResponse.json({ ok: true, status: "rejected", mail });
    }

    // Claim first so two clicks cannot create two accounts.
    const claim = await db().prepare("UPDATE manager_proposals SET status = 'approving' WHERE id = ? AND status = 'pending'").bind(r.id).run();
    if (!claim.meta.changes) return NextResponse.json({ error: "This request was already decided." }, { status: 409 });
    const release = () => db().prepare("UPDATE manager_proposals SET status = 'pending' WHERE id = ? AND status = 'approving'").bind(r.id).run().catch(() => {});

    const loginEmail = staffLogin(r.username, r.restaurant_id);
    const rest = await db().prepare("SELECT id FROM restaurants WHERE id = ? AND status != 'archived'").bind(r.restaurant_id).first();
    if (!rest) {
      await release();
      return NextResponse.json({ error: "That restaurant no longer exists." }, { status: 404 });
    }
    const chosen = (p.data.password || "").trim();
    if (chosen) {
      const weak = weakPassword(chosen, r.contact_email);
      if (weak) {
        await release();
        return NextResponse.json({ error: weak.replace("New password", "The password") }, { status: 400 });
      }
    }
    const tempPass = chosen || generateTemporaryPassword();
    try {
      const hash = await hashPassword(tempPass);
      await db()
        .prepare("INSERT INTO accounts (id, email, password_hash, name, role, restaurant_id, status, must_change_password, session_version, created_at, updated_at) VALUES (?, ?, ?, ?, 'admin', ?, 'active', 1, 1, ?, ?)")
        .bind("acc_" + crypto.randomBytes(6).toString("hex"), loginEmail, hash, r.name, r.restaurant_id, now, now)
        .run();
      await db().prepare("INSERT OR IGNORE INTO restaurant_members (restaurant_id, email) VALUES (?, ?)").bind(r.restaurant_id, loginEmail).run();
      await db().prepare("UPDATE manager_proposals SET status = 'approved', login_email = ?, note = ?, decided_at = ?, decided_by = ? WHERE id = ?").bind(loginEmail, p.data.note || "", now, a.email, r.id).run();
    } catch (e) {
      await release();
      if (isDuplicate(e)) return NextResponse.json({ error: "An account with that login name already exists." }, { status: 409 });
      throw e;
    }
    await logAudit({ action: "manager_proposal_decided", actorEmail: a.email, actorRole: a.role, targetType: "manager_proposal", targetId: r.id, details: { decision: "approved", login: loginEmail, restaurant_id: r.restaurant_id } });
    const m = managerApprovedEmail({ name: r.name, restaurantName, loginEmail, restaurantCode: r.restaurant_id, tempPassword: tempPass, proposedBy: r.proposer_name || r.proposed_by });
    const mail = await sendMail(r.contact_email, m.subject, m.html, m.text);
    // The temporary password is shown once to the Super Admin as well, in case the email does not arrive.
    return NextResponse.json({ ok: true, status: "approved", loginEmail, restaurantCode: r.restaurant_id, temporaryPassword: tempPass, mail });
  } catch (err) {
    return fail(err, "POST /api/manager-proposals", "Could not save that decision.");
  }
}

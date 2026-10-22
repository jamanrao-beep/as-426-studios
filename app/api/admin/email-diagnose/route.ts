import { NextResponse } from "next/server";
import { z } from "zod";
import { access, db, denied, sameOrigin } from "@/db/store";
import { logAudit } from "@/lib/audit";
import { fail, readJson } from "@/lib/http";
import { ensureSaasTables } from "@/lib/saas";
import { lookupForReset, maskEmail, RESET_EXPLANATION } from "@/lib/account-mail";
import { shortLogin } from "@/lib/login-id";
import { mailConfigured } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const schema = z.object({
  restaurant: z.string().trim().toLowerCase().max(60).optional(),
  username: z.string().trim().toLowerCase().min(1).max(190),
  // Give an account that has no email one. The reset code will go there.
  setEmail: z.string().trim().toLowerCase().email().max(190).optional(),
});

// Super Admin: "Why didn't the password reset code arrive?" Names the real reason for any login, which the public screen
// cannot do (it answers the same way for everyone so strangers cannot find out who has an account). Can also attach an
// email address to an account that has none.
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const a = await access();
    if (!a.owner) return denied(a, "Super Admin access required.");
    const body = await readJson(req);
    if (!body.ok) return body.res;
    const p = schema.safeParse(body.data);
    if (!p.success) return NextResponse.json({ error: "Enter the username, and the restaurant code if it has one." }, { status: 400 });
    await ensureSaasTables();

    let t = await lookupForReset({ username: p.data.username, restaurant: p.data.restaurant });
    if (p.data.setEmail) {
      if (!t || !t.id || t.role !== "admin") return NextResponse.json({ error: "Only a manager account can have an email attached." }, { status: 400 });
      const now = new Date().toISOString();
      await db()
        .prepare("INSERT INTO account_contacts (login, contact_email, name, set_by, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(login) DO UPDATE SET contact_email = excluded.contact_email, name = excluded.name, set_by = excluded.set_by, updated_at = excluded.updated_at")
        .bind(t.login, p.data.setEmail, t.name || null, a.email, now)
        .run();
      await logAudit({ action: "account_updated", actorEmail: a.email, actorRole: a.role, targetType: "account", targetId: t.login, details: { change: "contact_email_attached" } });
      t = await lookupForReset({ username: p.data.username, restaurant: p.data.restaurant });
    }
    if (!t) return NextResponse.json({ found: false, reason: "no_account", explanation: RESET_EXPLANATION.no_account });

    // When a code was last sent to that address, and how many in the past hour.
    let lastSentAt: string | null = null;
    let sends = 0;
    let waitSeconds = 0;
    if (t.contact) {
      const row = await db().prepare("SELECT sent_at, sends, window_start FROM email_codes WHERE email = ?").bind(t.contact.email.toLowerCase()).first<{ sent_at: string; sends: number; window_start: string }>();
      if (row) {
        lastSentAt = row.sent_at;
        const inHour = Date.now() - new Date(row.window_start).getTime() < 3600000;
        sends = inHour ? Number(row.sends) : 0;
        waitSeconds = Math.max(0, 60 - Math.floor((Date.now() - new Date(row.sent_at).getTime()) / 1000));
      }
    }
    return NextResponse.json({
      found: !!t.id,
      login: shortLogin(t.login),
      role: t.role,
      reason: t.reason,
      explanation: RESET_EXPLANATION[t.reason],
      emailOnFile: t.contact ? maskEmail(t.contact.email) : null,
      mailConfigured: mailConfigured(),
      lastCodeSentAt: lastSentAt,
      codesInLastHour: sends,
      waitSeconds,
      // At most 5 codes an hour and one a minute per address, to stop abuse. Shown here because the public screen stays silent.
      limitNote: sends >= 5 ? "5 codes were already sent to this address in the last hour. The next one can be sent once that hour has passed." : waitSeconds > 0 ? `A code was sent ${60 - waitSeconds} seconds ago. Wait ${waitSeconds} seconds before asking again.` : "",
    });
  } catch (err) {
    return fail(err, "POST /api/admin/email-diagnose", "Could not check that account.");
  }
}

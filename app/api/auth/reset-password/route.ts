import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { db, sameOrigin } from "@/db/store";
import { composeLogin } from "@/lib/usernames";
import { lookupForReset } from "@/lib/account-mail";
import { checkEmailCode, ensureSaasTables } from "@/lib/saas";
import { hashPassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";
import { sendMail } from "@/lib/mailer";
import { passwordChangedEmail } from "@/lib/mail-templates";
import { rateLimitDb } from "@/lib/rate-limit-db";
import { readJson, weakPassword } from "@/lib/http";

export const dynamic = "force-dynamic";

const BAD_CODE = "That code is not right or has expired. Ask for a new one.";

// "Forgot password", step 2. The person types the 6-digit code from their inbox and a new password. A right code sets the
// new password, signs every device out, and emails them a notice. Every failure gives the same answer, so nothing here
// reveals whether an account exists.
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const body = await readJson(req, 10_000);
    if (!body.ok) return body.res;
    const login = composeLogin(body.data as Record<string, unknown>);
    const p = z.object({ code: z.string().trim().regex(/^\d{6}$/), newPassword: z.string().min(1).max(100) }).safeParse(body.data);
    if (!login || !p.success) return NextResponse.json({ error: "Enter the 6-digit code and your new password." }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await rateLimitDb(`reset-ip:${ip}`, 20, 60 * 60 * 1000)).allowed || !(await rateLimitDb(`reset-acct:${login}`, 10, 60 * 60 * 1000)).allowed) {
      return NextResponse.json({ error: "Too many tries. Please try again in an hour." }, { status: 429 });
    }
    await ensureSaasTables();

    // The same account lookup as "Forgot password", so whichever login form the code was asked for also works here.
    const target = await lookupForReset(body.data as Record<string, unknown>);
    if (!target || target.reason !== "ok" || !target.contact) return NextResponse.json({ error: BAD_CODE }, { status: 400 });
    const contact = target.contact;
    const row = { id: target.id, email: target.login, role: target.role, name: target.name };

    const weak = weakPassword(p.data.newPassword, login);
    if (weak) return NextResponse.json({ error: weak.replace("New password", "The password") }, { status: 400 });

    const checked = await checkEmailCode(contact.email, p.data.code);
    if (!checked.ok) return NextResponse.json({ error: checked.error.startsWith("Too many") ? checked.error : BAD_CODE }, { status: 400 });

    const now = new Date().toISOString();
    // A new password, no forced change, and every signed-in device is signed out.
    await db()
      .prepare("UPDATE accounts SET password_hash = ?, must_change_password = 0, session_version = session_version + 1, updated_at = ? WHERE id = ?")
      .bind(await hashPassword(p.data.newPassword), now, row.id)
      .run();
    await logAudit({ action: "password_reset", actorId: row.id, actorEmail: row.email, actorRole: row.role, targetType: "account", targetId: row.id, details: { how: "email_code" } });

    const m = passwordChangedEmail({ name: contact.name || row.name, loginEmail: row.email, when: new Date() });
    after(async () => {
      try {
        await sendMail(contact.email, m.subject, m.html, m.text);
      } catch (e) {
        console.error("[reset password] notice email failed:", e);
      }
    });
    return NextResponse.json({ ok: true, message: "Your password was changed. Sign in with your new password." });
  } catch (err) {
    console.error("POST /api/auth/reset-password error:", err);
    return NextResponse.json({ error: "Could not reset the password. Please try again." }, { status: 503 });
  }
}

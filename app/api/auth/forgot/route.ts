import { NextResponse } from "next/server";
import { after } from "next/server";
import { sameOrigin } from "@/db/store";
import { lookupForReset } from "@/lib/account-mail";
import { composeLogin } from "@/lib/usernames";
import { ensureSaasTables, issueEmailCode } from "@/lib/saas";
import { mailConfigured, sendMail } from "@/lib/mailer";
import { resetCodeEmail } from "@/lib/mail-templates";
import { rateLimitDb } from "@/lib/rate-limit-db";
import { readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

// "Forgot password", step 1. Someone gives their restaurant code and username (or full login ID). If that account has an
// email address on file, we send a 6-digit code to it. The answer is the same whether or not the account exists, so this
// can never be used to find out who has an account. The Super Admin account is never reset this way, and waiters have no
// email, so they ask their manager.
const SAME_ANSWER = { ok: true, message: "If that account has an email address on file, we have sent a 6-digit code to it. It works for 10 minutes." };

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const body = await readJson(req, 10_000);
    if (!body.ok) return body.res;
    const login = composeLogin(body.data as Record<string, unknown>);
    if (!login || login.length > 190) return NextResponse.json({ error: "Enter your restaurant code and username." }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await rateLimitDb(`forgot-ip:${ip}`, 10, 60 * 60 * 1000)).allowed || !(await rateLimitDb(`forgot-acct:${login}`, 5, 60 * 60 * 1000)).allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again in an hour." }, { status: 429 });
    }
    await ensureSaasTables();

    const prod = process.env.NODE_ENV === "production";
    if (prod && !mailConfigured()) return NextResponse.json({ error: "Email sending is not set up yet. Please contact Table Secret." }, { status: 503 });

    const target = await lookupForReset(body.data as Record<string, unknown>);
    let devCode = "";
    // The reason is written to the server log (never shown here) so a missing email can always be explained: the Super
    // Admin screen "Why didn't a code arrive?" shows it in plain words.
    if (!target || target.reason !== "ok" || !target.contact) {
      console.info(`[forgot password] no code sent: ${target?.reason || "no_account"}`);
    } else {
      const contact = target.contact;
      const issued = await issueEmailCode(contact.email);
      if (!issued.ok) {
        console.info(`[forgot password] no code sent: ${issued.error}`);
      } else {
        const m = resetCodeEmail({ name: contact.name || target.name, loginEmail: target.login, code: issued.code });
        // Sent after the reply, so the answer takes the same time whether or not an email goes out.
        after(async () => {
          try {
            const sent = await sendMail(contact.email, m.subject, m.html, m.text);
            if (!sent.sent) console.error("[forgot password] email not sent:", sent.reason);
          } catch (e) {
            console.error("[forgot password] email failed:", e);
          }
        });
        if (!prod) devCode = issued.code;
      }
    }
    // Test mode only: hand back the code when there is one, so tests can finish the flow without a real inbox.
    return NextResponse.json(devCode ? { ...SAME_ANSWER, devCode } : SAME_ANSWER, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("POST /api/auth/forgot error:", err);
    return NextResponse.json({ error: "Could not send the code. Please try again." }, { status: 503 });
  }
}

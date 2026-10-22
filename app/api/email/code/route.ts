import { NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin } from "@/db/store";
import { ensureSaasTables, issueEmailCode } from "@/lib/saas";
import { mailConfigured, sendMail } from "@/lib/mailer";
import { otpEmail } from "@/lib/mail-templates";
import { rateLimitDb } from "@/lib/rate-limit-db";
import { readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

// Step 1 of verifying an email address anywhere in Table Secret: email a 6-digit code to it.
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const body = await readJson(req);
    if (!body.ok) return body.res;
    const p = z.object({ email: z.string().trim().toLowerCase().email().max(190) }).safeParse(body.data);
    if (!p.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await rateLimitDb(`emailcode:${ip}`, 30, 60 * 60 * 1000)).allowed) {
      return NextResponse.json({ error: "Too many requests from this device. Please try again later." }, { status: 429 });
    }
    await ensureSaasTables();

    const prod = process.env.NODE_ENV === "production";
    if (prod && !mailConfigured()) return NextResponse.json({ error: "Email sending is not set up yet. Please try again later." }, { status: 503 });

    const issued = await issueEmailCode(p.data.email);
    if (!issued.ok) return NextResponse.json({ error: issued.error }, { status: 429 });
    const mail = otpEmail(issued.code);
    const sent = await sendMail(p.data.email, mail.subject, mail.html, mail.text);
    if (!sent.sent && prod) {
      console.error("[email code] not sent:", sent.reason);
      return NextResponse.json({ error: "We could not send the email right now. Please try again in a few minutes." }, { status: 503 });
    }
    // Only outside production, so local testing works before email is set up.
    return NextResponse.json({ ok: true, ...(!prod && !sent.sent ? { devCode: issued.code } : {}) });
  } catch (err) {
    console.error("POST /api/email/code error:", err);
    return NextResponse.json({ error: "Could not send the code. Please try again." }, { status: 503 });
  }
}

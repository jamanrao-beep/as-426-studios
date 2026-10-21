import { NextResponse } from "next/server";
import { z } from "zod";
import { db, sameOrigin } from "@/db/store";
import { ensureSaasTables, issueEmailCode } from "@/lib/saas";
import { mailConfigured, sendMail } from "@/lib/mailer";
import { otpEmail } from "@/lib/mail-templates";
import { rateLimitDb } from "@/lib/rate-limit-db";

export const dynamic = "force-dynamic";

// Step 1 of "Test as guest": email a 6-digit code to the address the person typed.
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const p = z.object({ email: z.string().trim().toLowerCase().email().max(190) }).safeParse(await req.json());
    if (!p.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await rateLimitDb(`guestcode:${ip}`, 10, 60 * 60 * 1000)).allowed) {
      return NextResponse.json({ error: "Too many requests from this device. Please try again later." }, { status: 429 });
    }

    await ensureSaasTables();
    const used = await db().prepare("SELECT email FROM guest_used WHERE email = ?").bind(p.data.email).first();
    const stillActive = await db().prepare("SELECT email FROM guest_accounts WHERE LOWER(contact_email) = ?").bind(p.data.email).first();
    if (used && !stillActive) {
      return NextResponse.json({ error: "This email already used its guest week. Register your restaurant to continue." }, { status: 403 });
    }

    const prod = process.env.NODE_ENV === "production";
    if (prod && !mailConfigured()) {
      return NextResponse.json({ error: "Email sending is not set up yet. Please try again later." }, { status: 503 });
    }

    const issued = await issueEmailCode(p.data.email);
    if (!issued.ok) return NextResponse.json({ error: issued.error }, { status: 429 });

    const mail = otpEmail(issued.code);
    const sent = await sendMail(p.data.email, mail.subject, mail.html, mail.text);
    if (!sent.sent && prod) {
      // The real reason is for the server log. The person only needs to know it is not their fault.
      console.error("[guest code] email not sent:", sent.reason);
      return NextResponse.json({ error: "We could not send the email right now. Please try again in a few minutes." }, { status: 503 });
    }

    // Only outside production, so local testing works before email is set up.
    return NextResponse.json({ ok: true, mailSent: sent.sent, ...(!prod && !sent.sent ? { devCode: issued.code } : {}) });
  } catch (err) {
    console.error("POST /api/guest/code error:", err);
    return NextResponse.json({ error: "Could not send the code. Please try again." }, { status: 503 });
  }
}

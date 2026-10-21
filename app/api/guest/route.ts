import { NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin } from "@/db/store";
import { encodeSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { checkEmailCode, createGuest, GUEST_DAYS, GuestUsedError } from "@/lib/saas";
import { guestWelcomeEmail } from "@/lib/mail-templates";
import { sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(190),
  code: z.string().trim().regex(/^\d{6}$/),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(40),
});

// "Test as guest" is for real people: the email must be proven with a code, and each email gets one guest week.
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const p = schema.safeParse(await req.json());
    if (!p.success) return NextResponse.json({ error: "Enter your name, phone number and the 6-digit code from your email." }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`guest:${ip}`, 12, 60 * 60 * 1000).allowed) {
      return NextResponse.json({ error: "Too many attempts from this device. Please try again later." }, { status: 429 });
    }

    const checked = await checkEmailCode(p.data.email, p.data.code);
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

    let g;
    try {
      g = await createGuest(p.data.email, p.data.name, p.data.phone);
    } catch (e) {
      if (e instanceof GuestUsedError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }
    const token = encodeSession({
      userId: "acc_g_" + g.restaurantId.replace("guest-", ""),
      email: g.email,
      displayName: "Guest Manager",
      role: "admin",
      restaurantId: g.restaurantId,
      mustChangePassword: false,
      sessionVersion: 1,
    });
    if (!g.existing) {
      const mail = guestWelcomeEmail({ days: GUEST_DAYS });
      sendMail(p.data.email, mail.subject, mail.html, mail.text).catch(() => {});
    }
    return NextResponse.json({ token, expiresAt: g.expires, days: GUEST_DAYS });
  } catch (err) {
    console.error("POST /api/guest error:", err);
    return NextResponse.json({ error: "Could not start a guest session. Please try again." }, { status: 503 });
  }
}

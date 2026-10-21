import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, sameOrigin } from "@/db/store";
import { getAuthUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { ensureSaasTables, isGuestEmail } from "@/lib/saas";
import { sendMail } from "@/lib/mailer";
import { supportEmail } from "@/lib/mail-templates";

export const dynamic = "force-dynamic";

// A question Mira could not answer. It is saved and emailed to the Table Secret inbox,
// with the asker as Reply-To so the team can answer straight from their mail.
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const p = z
      .object({
        question: z.string().trim().min(5, "Please write a little more.").max(1500),
        email: z.string().trim().toLowerCase().email("Enter a valid email so we can reply.").max(190),
        name: z.string().trim().max(120).optional(),
      })
      .safeParse(await req.json());
    if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message || "Check your question." }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`support:${ip}`, 8, 60 * 60 * 1000).allowed) {
      return NextResponse.json({ error: "You have sent a lot of questions. Please try again later." }, { status: 429 });
    }

    const user = await getAuthUser().catch(() => null);
    const role = user ? ((await isGuestEmail(user.email)) ? "guest" : user.role) : undefined;
    const restaurant = user?.restaurantId || undefined;

    await ensureSaasTables();
    const id = "q_" + randomUUID().slice(0, 12);
    const mail = supportEmail({ name: p.data.name, email: p.data.email, role, restaurant, question: p.data.question });
    const to = process.env.SUPPORT_EMAIL || process.env.MAIL_USER || "";
    const sent = to ? await sendMail(to, mail.subject, mail.html, mail.text, p.data.email) : { sent: false };
    await db()
      .prepare("INSERT INTO support_questions (id, created_at, name, email, role, restaurant, question, emailed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, new Date().toISOString(), p.data.name || null, p.data.email, role || null, restaurant || null, p.data.question, sent.sent ? 1 : 0)
      .run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/support error:", err);
    return NextResponse.json({ error: "Could not send your question. Please try again." }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, sameOrigin } from "@/db/store";
import { getAuthUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { ensureSaasTables } from "@/lib/saas";
import { contactFor } from "@/lib/support";
import { sendMail } from "@/lib/mailer";
import { supportEmail } from "@/lib/mail-templates";
import { rateLimitDb } from "@/lib/rate-limit-db";

export const dynamic = "force-dynamic";

// A question Mira could not answer. It is saved for the Super Admin's Queries table and emailed to the
// Table Secret inbox with the asker as Reply-To. Signed-in people are matched to the contact details
// they gave when registering, so they never retype them.
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const p = z
      .object({
        question: z.string().trim().min(5, "Please write a little more.").max(1500),
        email: z.string().trim().toLowerCase().email("Enter a valid email so we can reply.").max(190).optional(),
        name: z.string().trim().max(120).optional(),
        phone: z.string().trim().max(40).optional(),
      })
      .safeParse(await req.json());
    if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message || "Check your question." }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await rateLimitDb(`support:${ip}`, 8, 60 * 60 * 1000)).allowed) {
      return NextResponse.json({ error: "You have sent a lot of questions. Please try again later." }, { status: 429 });
    }

    const user = await getAuthUser().catch(() => null);
    const known = user ? await contactFor(user) : null;
    const email = (known?.email || p.data.email || "").toLowerCase();
    if (!email) return NextResponse.json({ error: "Enter your email so we can reply.", needEmail: true }, { status: 400 });
    const name = known?.name || p.data.name || undefined;
    const phone = known?.phone || p.data.phone || undefined;
    const role = known?.role;
    const restaurantName = known?.restaurantName;

    await ensureSaasTables();
    const id = "q_" + randomUUID().slice(0, 12);
    const mail = supportEmail({ name, email, phone, role, restaurant: restaurantName, question: p.data.question });
    const to = process.env.SUPPORT_EMAIL || process.env.MAIL_USER || "";
    const sent = to ? await sendMail(to, mail.subject, mail.html, mail.text, email) : { sent: false };
    await db()
      .prepare(
        "INSERT INTO support_questions (id, created_at, name, email, role, restaurant, question, emailed, phone, user_email, restaurant_id, status, reply_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 1)"
      )
      .bind(
        id,
        new Date().toISOString(),
        name || null,
        email,
        role || null,
        restaurantName || null,
        p.data.question,
        sent.sent ? 1 : 0,
        phone || null,
        user?.email.toLowerCase() || null,
        user?.restaurantId || null
      )
      .run();
    return NextResponse.json({ ok: true, id, email });
  } catch (err) {
    console.error("POST /api/support error:", err);
    return NextResponse.json({ error: "Could not send your question. Please try again." }, { status: 503 });
  }
}

// The signed-in person's own questions with our replies, and how many replies they have not read yet.
export async function GET() {
  try {
    const user = await getAuthUser().catch(() => null);
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    await ensureSaasTables();
    const rows = await db()
      .prepare("SELECT id, question, status, reply, replied_at, created_at, reply_seen FROM support_questions WHERE user_email = ? ORDER BY created_at DESC LIMIT 20")
      .bind(user.email.toLowerCase())
      .all<{ id: string; question: string; status: string | null; reply: string | null; replied_at: string | null; created_at: string; reply_seen: number | null }>();
    const items = rows.results.map((r) => ({ ...r, unseen: !!r.reply && !r.reply_seen })).reverse();
    return NextResponse.json({ items, unseen: items.filter((i) => i.unseen).length }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/support error:", err);
    return NextResponse.json({ error: "Could not load your questions." }, { status: 503 });
  }
}

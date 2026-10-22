import { NextResponse } from "next/server";
import { z } from "zod";
import { access, db, sameOrigin } from "@/db/store";
import { ensureSaasTables } from "@/lib/saas";
import { sendMail } from "@/lib/mailer";
import { replyEmail } from "@/lib/mail-templates";
import { sendPush } from "@/lib/push-server";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  created_at: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string | null;
  restaurant: string | null;
  restaurant_id: string | null;
  user_email: string | null;
  question: string;
  status: string | null;
  reply: string | null;
  replied_at: string | null;
  reply_seen: number | null;
};

// Super Admin: every question people sent from the app, with who they are and how to reach them.
export async function GET() {
  try {
    const a = await access();
    if (!a.owner) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    await ensureSaasTables();
    const rows = await db()
      .prepare(
        "SELECT id, created_at, name, email, phone, role, restaurant, restaurant_id, user_email, question, status, reply, replied_at, reply_seen FROM support_questions ORDER BY created_at DESC LIMIT 300"
      )
      .all<Row>();
    const queries = rows.results.map((r) => ({
      ...r,
      status: r.reply ? "answered" : r.status === "closed" ? "closed" : "open",
      inApp: !!r.user_email,
    }));
    return NextResponse.json({ queries, open: queries.filter((q) => q.status === "open").length }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/admin/queries error:", err);
    return NextResponse.json({ error: "Could not load the queries." }, { status: 503 });
  }
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reply"), id: z.string().min(3).max(40), reply: z.string().trim().min(2, "Write a reply first.").max(3000) }),
  z.object({ action: z.literal("close"), id: z.string().min(3).max(40) }),
  z.object({ action: z.literal("delete"), id: z.string().min(3).max(40) }),
]);

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const a = await access();
    if (!a.owner) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const p = schema.safeParse(await req.json());
    if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message || "Invalid request." }, { status: 400 });
    await ensureSaasTables();

    const row = await db()
      .prepare("SELECT id, name, email, user_email, question FROM support_questions WHERE id = ?")
      .bind(p.data.id)
      .first<{ id: string; name: string | null; email: string; user_email: string | null; question: string }>();
    if (!row) return NextResponse.json({ error: "That question no longer exists." }, { status: 404 });

    if (p.data.action === "delete") {
      await db().prepare("DELETE FROM support_questions WHERE id = ?").bind(row.id).run();
      return NextResponse.json({ ok: true });
    }
    if (p.data.action === "close") {
      await db().prepare("UPDATE support_questions SET status = 'closed' WHERE id = ?").bind(row.id).run();
      return NextResponse.json({ ok: true });
    }

    // Reply: saved so it shows in the asker's app, emailed to them, and pushed to their phone when signed in.
    await db()
      .prepare("UPDATE support_questions SET reply = ?, replied_at = ?, status = 'answered', reply_seen = 0 WHERE id = ?")
      .bind(p.data.reply, new Date().toISOString(), row.id)
      .run();
    const mail = replyEmail({ name: row.name || undefined, question: row.question, reply: p.data.reply });
    const sent = await sendMail(row.email, mail.subject, mail.html, mail.text);
    let pushed = 0;
    if (row.user_email) {
      pushed = (await sendPush({ emails: [row.user_email] }, "Table Secret replied to your question", p.data.reply.slice(0, 140), { type: "support-reply", id: row.id })).sent;
    }
    return NextResponse.json({ ok: true, mail: { sent: sent.sent, reason: sent.reason }, pushed });
  } catch (err) {
    console.error("POST /api/admin/queries error:", err);
    return NextResponse.json({ error: "Could not save that." }, { status: 503 });
  }
}

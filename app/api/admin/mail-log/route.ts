import { NextResponse } from "next/server";
import { access, db, denied } from "@/db/store";

export const dynamic = "force-dynamic";

// Super Admin: the last emails the server tried to send, newest first, with the reason when one did not go.
export async function GET() {
  const a = await access();
  if (!a.owner) return denied(a, "Super Admin access required.");
  try {
    const rows = await db()
      .prepare("SELECT to_email, subject, sent, reason, created_at FROM mail_log ORDER BY created_at DESC LIMIT 40")
      .all<{ to_email: string; subject: string; sent: number; reason: string | null; created_at: string }>();
    return NextResponse.json({ emails: rows.results.map((r) => ({ to: r.to_email, subject: r.subject, sent: !!r.sent, reason: r.reason, at: r.created_at })) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // The table is made the first time an email is sent. Until then there is nothing to show.
    return NextResponse.json({ emails: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}

import { NextResponse } from "next/server";
import { db, sameOrigin } from "@/db/store";
import { getAuthUser } from "@/lib/auth";
import { ensureSaasTables } from "@/lib/saas";

export const dynamic = "force-dynamic";

// The person opened Mira's chat, so every reply they were sent counts as read.
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const user = await getAuthUser().catch(() => null);
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    await ensureSaasTables();
    await db().prepare("UPDATE support_questions SET reply_seen = 1 WHERE user_email = ? AND reply IS NOT NULL").bind(user.email.toLowerCase()).run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/support/seen error:", err);
    return NextResponse.json({ error: "Could not update." }, { status: 503 });
  }
}

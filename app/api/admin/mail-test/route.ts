import { NextResponse } from "next/server";
import { z } from "zod";
import { access, sameOrigin } from "@/db/store";
import { mailStatus, sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

// Super Admin: is email sending set up, and does it actually work? Shows the real reason when it does not.
export async function GET() {
  const a = await access();
  if (!a.owner) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
  return NextResponse.json(mailStatus(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const a = await access();
    if (!a.owner) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const p = z.object({ to: z.string().trim().toLowerCase().email().max(190) }).safeParse(await req.json().catch(() => null));
    if (!p.success) return NextResponse.json({ error: "Enter an email address to send the test to." }, { status: 400 });
    const r = await sendMail(
      p.data.to,
      "Table Secret test email",
      "<p>This is a test email from Table Secret. If you can read it, email sending works.</p>",
      "This is a test email from Table Secret. If you can read it, email sending works."
    );
    return NextResponse.json({ ...r, status: mailStatus() });
  } catch (err) {
    console.error("POST /api/admin/mail-test error:", err);
    return NextResponse.json({ error: "Could not run the email test." }, { status: 503 });
  }
}

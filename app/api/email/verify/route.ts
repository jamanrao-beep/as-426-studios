import { NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin } from "@/db/store";
import { checkEmailCode, ensureSaasTables } from "@/lib/saas";
import { makeEmailProof } from "@/lib/email-proof";
import { rateLimitDb } from "@/lib/rate-limit-db";
import { readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

// Step 2: the person types the code from their inbox. A right code gives back a proof token that the form sends with
// the email address, so the server knows the address was checked.
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const body = await readJson(req);
    if (!body.ok) return body.res;
    const p = z.object({ email: z.string().trim().toLowerCase().email().max(190), code: z.string().trim().regex(/^\d{6}$/) }).safeParse(body.data);
    if (!p.success) return NextResponse.json({ error: "Enter the 6-digit code from your email." }, { status: 400 });
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await rateLimitDb(`emailverify:${ip}`, 60, 60 * 60 * 1000)).allowed) {
      return NextResponse.json({ error: "Too many tries. Please try again later." }, { status: 429 });
    }
    await ensureSaasTables();
    const checked = await checkEmailCode(p.data.email, p.data.code);
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
    return NextResponse.json({ ok: true, proof: makeEmailProof(p.data.email) });
  } catch (err) {
    console.error("POST /api/email/verify error:", err);
    return NextResponse.json({ error: "Could not check the code. Please try again." }, { status: 503 });
  }
}

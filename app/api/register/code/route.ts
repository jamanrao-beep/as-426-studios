import { NextResponse } from "next/server";
import { ensureSaasTables } from "@/lib/saas";
import { checkCodeFree, suggestCode } from "@/lib/restaurant-code";
import { rateLimitDb } from "@/lib/rate-limit-db";

export const dynamic = "force-dynamic";

// Live check on the sign-up form: is this restaurant code free? With `name` and no `code`, it suggests one made from the
// restaurant's name. (It tells people whether a code is taken, which is public anyway: it is in every restaurant's link.)
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await rateLimitDb(`codecheck:${ip}`, 120, 60 * 60 * 1000)).allowed) {
      return NextResponse.json({ error: "Too many checks. Please slow down." }, { status: 429 });
    }
    await ensureSaasTables();
    const typed = (u.searchParams.get("code") || "").trim().toLowerCase();
    const suggestion = suggestCode(u.searchParams.get("name") || "");
    const code = typed || suggestion;
    if (!code) return NextResponse.json({ available: false, reason: "Type your restaurant name first.", suggestion }, { headers: { "Cache-Control": "no-store" } });
    const r = await checkCodeFree(code);
    return NextResponse.json(r.ok ? { available: true, code, suggestion } : { available: false, code, reason: r.reason, suggestion }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/register/code error:", err);
    return NextResponse.json({ error: "Could not check that code." }, { status: 503 });
  }
}

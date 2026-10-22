import { NextResponse } from "next/server";
import { listPlans } from "@/lib/saas";
import { buildKb } from "@/lib/help-kb";

export const dynamic = "force-dynamic";

// Mira's answers for the phone app and the website. One source, so the two never disagree.
export async function GET(req: Request) {
  try {
    const plans = await listPlans({ activeOnly: true });
    return NextResponse.json({ entries: buildKb(plans, new URL(req.url).searchParams.get("client") === "web" ? "web" : "app") }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/help error:", err);
    return NextResponse.json({ error: "Could not load help." }, { status: 503 });
  }
}

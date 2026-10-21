import { NextResponse } from "next/server";
import { listPlans, TRIAL_BASE_DAYS, TRIAL_BONUS_DAYS, TRIAL_DAYS } from "@/lib/saas";

export const dynamic = "force-dynamic";

// The public price list, straight from the database. The apply page and the app read it, so a price the
// Super Admin changes shows up everywhere at once.
export async function GET() {
  try {
    const plans = await listPlans({ activeOnly: true });
    return NextResponse.json({ plans, trialDays: TRIAL_DAYS, trialBaseDays: TRIAL_BASE_DAYS, trialBonusDays: TRIAL_BONUS_DAYS }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/plans error:", err);
    return NextResponse.json({ error: "Could not load the plans." }, { status: 503 });
  }
}

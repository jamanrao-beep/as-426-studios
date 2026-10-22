import { NextResponse } from "next/server";
import { db } from "@/db/store";
import { getAuthUser } from "@/lib/auth";
import { ensureSaasTables, getSubscription } from "@/lib/saas";

export const dynamic = "force-dynamic";

// The page or app showing a UPI QR asks this every few seconds: has the payment landed yet? Only the manager of the
// restaurant that started the payment can see it.
export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Please sign in to continue.", code: "none" }, { status: 401 });
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!/^pay_[a-f0-9]{16}$/.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
    await ensureSaasTables();
    const row = await db().prepare("SELECT restaurant_id, status, plan_key FROM payments WHERE id = ?").bind(id).first<{ restaurant_id: string; status: string; plan_key: string }>();
    if (!row || row.restaurant_id !== user.restaurantId) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const paid = row.status === "paid";
    return NextResponse.json({ status: paid ? "paid" : "waiting", plan: row.plan_key, subscription: paid ? await getSubscription(row.restaurant_id) : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/payments/status error:", err);
    return NextResponse.json({ error: "Could not check the payment." }, { status: 503 });
  }
}

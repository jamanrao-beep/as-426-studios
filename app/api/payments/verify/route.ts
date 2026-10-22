import { NextResponse } from "next/server";
import { z } from "zod";
import { access, db, sameOrigin } from "@/db/store";
import { logAudit } from "@/lib/audit";
import { readJson } from "@/lib/http";
import { ensureSaasTables, getSubscription, settlePayment } from "@/lib/saas";
import { verifyCheckoutSignature } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

const schema = z.object({ orderId: z.string().min(5).max(80), paymentId: z.string().min(5).max(80), signature: z.string().min(20).max(200) });

// The checkout window finished. Razorpay's signature proves this payment really belongs to this order, then the plan
// is switched on straight away. (The webhook does the same if the browser is closed first; whichever lands first wins.)
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const a = await access();
    if (!a.role || a.owner || !a.restaurantId) return NextResponse.json({ error: "Please sign in as the restaurant manager." }, { status: 401 });
    const body = await readJson(req);
    if (!body.ok) return body.res;
    const p = schema.safeParse(body.data);
    if (!p.success) return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
    if (!verifyCheckoutSignature(p.data.orderId, p.data.paymentId, p.data.signature)) {
      return NextResponse.json({ error: "We could not confirm this payment." }, { status: 400 });
    }
    await ensureSaasTables();
    // The payment must belong to the caller's own restaurant.
    const row = await db().prepare("SELECT restaurant_id FROM payments WHERE provider_ref = ?").bind(p.data.orderId).first<{ restaurant_id: string }>();
    if (!row || row.restaurant_id !== a.restaurantId) return NextResponse.json({ error: "We could not find this payment." }, { status: 404 });
    const r = await settlePayment(p.data.orderId, p.data.paymentId);
    if (!r.ok) return NextResponse.json({ error: "We could not confirm this payment." }, { status: 400 });
    if (!r.already) {
      await logAudit({ action: "subscription_updated", actorEmail: a.email, actorRole: a.role, targetType: "restaurant", targetId: a.restaurantId, details: { change: "paid_online", plan: r.plan, payment: p.data.paymentId } });
    }
    return NextResponse.json({ ok: true, subscription: await getSubscription(a.restaurantId) });
  } catch (err) {
    console.error("POST /api/payments/verify error:", err);
    return NextResponse.json({ error: "Could not confirm the payment. If money was taken, your plan will switch on shortly." }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { settlePayment } from "@/lib/saas";
import { verifyWebhook } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

// Razorpay tells us a payment succeeded, even if the buyer closed the page. There is no sign-in here: the only proof
// is the signature over the raw body, made with the webhook secret. Add it in Razorpay Dashboard > Webhooks with the
// events payment.captured, order.paid, payment_link.paid and qr_code.credited.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("x-razorpay-signature") || "")) {
    return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  }
  try {
    const evt = JSON.parse(raw) as any;
    const event: string = evt.event || "";
    let ref = "";
    let paymentId = "";
    let paid: number | null = null;
    if (event === "payment_link.paid") {
      ref = evt.payload?.payment_link?.entity?.id || "";
      paymentId = evt.payload?.payment?.entity?.id || "";
      paid = evt.payload?.payment_link?.entity?.amount_paid ?? evt.payload?.payment?.entity?.amount ?? null;
    } else if (event === "qr_code.credited") {
      ref = evt.payload?.qr_code?.entity?.id || "";
      paymentId = evt.payload?.payment?.entity?.id || "";
      paid = evt.payload?.payment?.entity?.amount ?? null;
    } else if (event === "order.paid" || event === "payment.captured") {
      ref = evt.payload?.order?.entity?.id || evt.payload?.payment?.entity?.order_id || "";
      paymentId = evt.payload?.payment?.entity?.id || "";
      paid = evt.payload?.payment?.entity?.amount ?? evt.payload?.order?.entity?.amount_paid ?? null;
    } else {
      return NextResponse.json({ ok: true, ignored: event });
    }
    if (!ref || !paymentId) return NextResponse.json({ ok: true, ignored: "no reference" });
    const r = await settlePayment(ref, paymentId, paid);
    if (r.ok && !r.already) {
      await logAudit({ action: "subscription_updated", actorEmail: "razorpay", actorRole: "system", targetType: "restaurant", targetId: r.restaurantId, details: { change: "paid_online", plan: r.plan, payment: paymentId } });
    }
    // A payment we do not know about (or whose amount does not match) is acknowledged so Razorpay stops retrying,
    // and logged so it can be looked at.
    if (!r.ok) console.error("[razorpay webhook] not settled:", r.reason, ref, paymentId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/payments/webhook error:", err);
    // A real failure: tell Razorpay to try again later.
    return NextResponse.json({ error: "Could not process." }, { status: 500 });
  }
}

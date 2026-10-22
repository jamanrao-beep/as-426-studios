import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { db, sameOrigin } from "@/db/store";
import { readJson } from "@/lib/http";
import { ensureSaasTables, getPlan, isGuestEmail } from "@/lib/saas";
import { contactFor } from "@/lib/support";
import { createOrder, createPaymentLink, createUpiQr, razorpayConfigured, razorpayKeyId } from "@/lib/razorpay";
import { rateLimitDb } from "@/lib/rate-limit-db";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({ plan: z.string().min(2).max(16), mode: z.enum(["web", "link", "qr"]).default("web") });

// A manager starts paying for a plan. The price comes from the plan in our database, never from the request.
//   mode "web":  an order for the Razorpay checkout window on the website
//   mode "link": a hosted payment page (cards, net banking, UPI) opened in the browser
//   mode "qr":   a one-time UPI QR for the exact amount, shown inside the app or page, with no redirect
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    if (!razorpayConfigured()) return NextResponse.json({ error: "Online payment is not switched on yet.", code: "not_configured" }, { status: 503 });
    // Signed-in manager only. This deliberately skips the "plan expired" gate: a manager whose plan has run out has to
    // be able to pay.
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Please sign in to continue.", code: "none" }, { status: 401 });
    if (user.role !== "admin" || !user.restaurantId) return NextResponse.json({ error: "Only the restaurant manager can pay for a plan." }, { status: 403 });
    const a = { email: user.email, restaurantId: user.restaurantId };
    if (await isGuestEmail(a.email)) return NextResponse.json({ error: "Register your restaurant to choose a plan." }, { status: 403 });
    const body = await readJson(req);
    if (!body.ok) return body.res;
    const p = schema.safeParse(body.data);
    if (!p.success) return NextResponse.json({ error: "Choose a plan." }, { status: 400 });
    if (!(await rateLimitDb(`pay:${a.email.toLowerCase()}`, 12, 60 * 60 * 1000)).allowed) {
      return NextResponse.json({ error: "Too many attempts. Please try again in a while." }, { status: 429 });
    }
    await ensureSaasTables();
    const plan = await getPlan(p.data.plan);
    if (!plan || !plan.active) return NextResponse.json({ error: "That plan is not available any more." }, { status: 400 });
    const amount = Math.round(plan.price * 100);
    if (!(amount >= 100)) return NextResponse.json({ error: "This plan has no price yet." }, { status: 400 });

    const id = "pay_" + crypto.randomBytes(8).toString("hex");
    const now = new Date().toISOString();
    const who = await contactFor(user).catch(() => null);
    const notes = { payment_id: id, restaurant_id: a.restaurantId, plan: plan.key };

    let ref = "";
    let out: Record<string, unknown>;
    if (p.data.mode === "qr") {
      const closeBy = Math.floor(Date.now() / 1000) + 15 * 60;
      let qr;
      try {
        qr = await createUpiQr({ amountPaise: amount, name: "Table Secret", description: `${plan.label} plan`, notes, closeBy });
      } catch (e) {
        // QR Codes may not be switched on for the Razorpay account yet. The page falls back to the normal checkout.
        console.error("razorpay qr unavailable:", e instanceof Error ? e.message : e);
        return NextResponse.json({ error: "UPI QR is not available right now.", code: "qr_unavailable" }, { status: 502 });
      }
      ref = qr.id;
      const content = qr.image_content && qr.image_content.startsWith("upi://") ? qr.image_content : "";
      out = { upi: content, imageUrl: qr.image_url || "", expiresAt: new Date(closeBy * 1000).toISOString(), amount };
    } else if (p.data.mode === "link") {
      const link = await createPaymentLink({
        amountPaise: amount,
        reference: id,
        description: `Table Secret ${plan.label} plan`,
        name: who?.name,
        email: who?.email,
        phone: who?.phone,
      });
      ref = link.id;
      out = { url: link.short_url };
    } else {
      const order = await createOrder(amount, id, notes);
      ref = order.id;
      out = { keyId: razorpayKeyId(), orderId: order.id, amount: order.amount, currency: order.currency, name: "Table Secret", description: `${plan.label} plan`, prefill: { name: who?.name || "", email: who?.email || "", contact: who?.phone || "" } };
    }
    await db()
      .prepare("INSERT INTO payments (id, restaurant_id, plan_key, amount, status, kind, provider_ref, paid_by, created_at) VALUES (?, ?, ?, ?, 'created', ?, ?, ?, ?)")
      .bind(id, a.restaurantId, plan.key, amount, p.data.mode === "link" ? "link" : p.data.mode === "qr" ? "qr" : "order", ref, a.email.toLowerCase(), now)
      .run();
    return NextResponse.json({ ok: true, paymentId: id, ...out });
  } catch (err) {
    console.error("POST /api/payments/checkout error:", err);
    return NextResponse.json({ error: "Could not start the payment. Please try again." }, { status: 503 });
  }
}

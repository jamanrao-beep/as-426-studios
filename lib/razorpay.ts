import crypto from "node:crypto";

// Razorpay, called straight over HTTPS (no SDK). The secret keys only ever live in the server settings.
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET   from Razorpay Dashboard > Account & Settings > API keys
//   RAZORPAY_WEBHOOK_SECRET                the secret you type when you add the webhook
// RAZORPAY_API_BASE exists only so tests can point at a fake server.
const BASE = () => process.env.RAZORPAY_API_BASE || "https://api.razorpay.com";
const keyId = () => (process.env.RAZORPAY_KEY_ID || "").trim();
const keySecret = () => (process.env.RAZORPAY_KEY_SECRET || "").trim();
const webhookSecret = () => (process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();

export const razorpayConfigured = () => !!keyId() && !!keySecret();
export const razorpayKeyId = keyId;
export const razorpayTestMode = () => keyId().startsWith("rzp_test_");

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE() + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Basic " + Buffer.from(`${keyId()}:${keySecret()}`).toString("base64") },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(data?.error?.description || `Razorpay said ${res.status}.`);
  return data as T;
}

// Amounts are in paise. `receipt` is our own payment id so the two sides can always be matched.
export function createOrder(amountPaise: number, receipt: string, notes: Record<string, string>) {
  return call<{ id: string; amount: number; currency: string }>("/v1/orders", { amount: amountPaise, currency: "INR", receipt, notes });
}

// A hosted payment page, used by the phone app (which cannot run the web checkout).
export function createPaymentLink(p: { amountPaise: number; reference: string; description: string; name?: string; email?: string; phone?: string; callbackUrl?: string }) {
  return call<{ id: string; short_url: string }>("/v1/payment_links", {
    amount: p.amountPaise,
    currency: "INR",
    reference_id: p.reference,
    description: p.description,
    customer: { name: p.name || undefined, email: p.email || undefined, contact: p.phone || undefined },
    notify: { sms: false, email: false },
    reminder_enable: false,
    callback_url: p.callbackUrl,
    callback_method: p.callbackUrl ? "get" : undefined,
  });
}

// A single-use UPI QR for an exact amount: the buyer scans it (or opens it in their UPI app) and pays, and Razorpay tells
// us by webhook. The code stops working after `closeBy`. Razorpay has to enable "QR Codes" on the account first.
export function createUpiQr(p: { amountPaise: number; name: string; description: string; notes: Record<string, string>; closeBy: number }) {
  return call<{ id: string; image_url?: string; image_content?: string }>("/v1/payments/qr_codes", {
    type: "upi_qr",
    name: p.name,
    usage: "single_use",
    fixed_amount: true,
    payment_amount: p.amountPaise,
    description: p.description,
    close_by: p.closeBy,
    notes: p.notes,
  });
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// The browser hands back order id, payment id and a signature. Only Razorpay (holding our secret) can make a valid one.
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  if (!keySecret() || !orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac("sha256", keySecret()).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqual(expected, signature);
}

// Razorpay signs the raw webhook body with the webhook secret.
export function verifyWebhook(rawBody: string, signature: string) {
  if (!webhookSecret() || !signature) return false;
  const expected = crypto.createHmac("sha256", webhookSecret()).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}

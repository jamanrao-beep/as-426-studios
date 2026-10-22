"use client";

import { useEffect, useState } from "react";
import { Check, Crown } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

// Plan and billing for a restaurant manager. Mirrors the app's Plans screen: current status, a plan picker that starts
// on the best-value plan, one card per plan, and one request button.

type Plan = { key: string; label: string; price: number; strike: number; months: number; blurb: string; best: boolean };
type Sub = { status: "trial" | "active" | "expired" | "none"; plan: string; endsAt: string | null; msLeft: number; requestedPlan: string };

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
const FEATURES = ["Unlimited orders and dishes", "Live order alerts on every phone", "Waiter accounts for your team", "Sales, dish performance and reviews", "Your QR code and menu link"];

export function timeLeft(ms: number) {
  if (ms <= 0) return "ended";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function loadCheckout() {
  return new Promise<void>((resolve) => {
    if ((window as any).Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.body.appendChild(s);
  });
}

export default function Billing({ onChange }: { onChange?: () => void }) {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [trial, setTrial] = useState<{ base: number; bonus: number; total: number } | null>(null);
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payOnline, setPayOnline] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [guest, setGuest] = useState(false);
  // A UPI QR shown on this page while we wait for the payment to land.
  const [qr, setQr] = useState<{ id: string; img: string; upi: string; expiresAt: number; plan: string } | null>(null);
  const [now, setNow] = useState(Date.now());

  async function load() {
    try {
      const r = await fetch("/api/subscription", { cache: "no-store" });
      const d = (await r.json()) as any;
      if (!r.ok) throw new Error(d.error || "Could not load your plan");
      setPlans(d.plans);
      setSub(d.subscription);
      setTrial({ base: d.trialBaseDays, bonus: d.trialBonusDays, total: d.trialDays });
      setGuest(!!d.guest);
      setPayOnline(!!d.payOnline);
      setTestMode(!!d.payTestMode);
      setPicked((p) => p || (d.plans.find((x: Plan) => x.best) || d.plans[0])?.key || "");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your plan");
    }
  }
  useEffect(() => {
    load();
  }, []);

  const plan = plans?.find((p) => p.key === picked) || null;
  const requested = sub?.requestedPlan || "";
  const nameOf = (k: string) => plans?.find((p) => p.key === k)?.label || "chosen";
  const status =
    !sub || sub.status === "none"
      ? "Choose the plan that fits you."
      : sub.status === "trial"
      ? `Free trial · ${timeLeft(sub.msLeft)} left`
      : sub.status === "active"
      ? `${sub.plan ? nameOf(sub.plan) : "Your"} plan active until ${sub.endsAt ? new Date(sub.endsAt).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—"}`
      : "Your access has ended. Choose a plan to keep using Table Secret.";

  async function request() {
    if (!plan) return;
    setBusy(true);
    try {
      const r = await fetch("/api/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: plan.key }) });
      const d = (await r.json()) as any;
      if (!r.ok) throw new Error(d.error || "Could not send your request");
      toast.success(`${plan.label} plan requested. Our team will contact you to complete payment.`);
      await load();
      onChange?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send your request");
    } finally {
      setBusy(false);
    }
  }

  // Pay now: our server makes the order (the price comes from the plan, not from this page), Razorpay's checkout takes
  // the payment, and our server confirms it with Razorpay's signature before switching the plan on.
  async function pay() {
    if (!plan) return;
    setBusy(true);
    try {
      const r = await fetch("/api/payments/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: plan.key, mode: "web" }) });
      const o = (await r.json()) as any;
      if (!r.ok) throw new Error(o.error || "Could not start the payment");
      await loadCheckout();
      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) throw new Error("The payment window could not load. Check your connection and try again.");
      const box = new Razorpay({
        key: o.keyId,
        order_id: o.orderId,
        amount: o.amount,
        currency: o.currency,
        name: o.name,
        description: o.description,
        prefill: o.prefill,
        theme: { color: "#C2410C" },
        handler: async (resp: any) => {
          try {
            const v = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature }),
            });
            const d = (await v.json()) as any;
            if (!v.ok) throw new Error(d.error || "Could not confirm the payment");
            toast.success(`Payment received. Your ${plan.label} plan is active.`);
            await load();
            onChange?.();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not confirm the payment");
            load();
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      box.on?.("payment.failed", (f: any) => {
        toast.error(f?.error?.description || "The payment did not go through.");
        setBusy(false);
      });
      box.open();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the payment");
      setBusy(false);
    }
  }

  // Pay with a UPI QR for the exact amount: scan it with any UPI app. No redirect, and the page notices the payment itself.
  async function payQr() {
    if (!plan) return;
    setBusy(true);
    try {
      const r = await fetch("/api/payments/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: plan.key, mode: "qr" }) });
      const o = (await r.json()) as any;
      if (!r.ok) {
        // QR not switched on for the account (or it failed): use the normal payment window instead.
        if (o.code === "qr_unavailable") return pay();
        throw new Error(o.error || "Could not start the payment");
      }
      const img = o.upi ? await QRCode.toDataURL(o.upi, { margin: 1, width: 280 }) : o.imageUrl || "";
      if (!img) return pay();
      setQr({ id: o.paymentId, img, upi: o.upi || "", expiresAt: new Date(o.expiresAt).getTime(), plan: plan.label });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the payment");
    } finally {
      setBusy(false);
    }
  }

  // While a QR is showing, ask every 3 seconds whether the payment arrived, and count down its 15 minutes.
  useEffect(() => {
    if (!qr) return;
    let alive = true;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const check = setInterval(async () => {
      try {
        const r = await fetch(`/api/payments/status?id=${qr.id}`, { cache: "no-store" });
        const d = (await r.json()) as any;
        if (alive && r.ok && d.status === "paid") {
          setQr(null);
          toast.success(`Payment received. Your ${qr.plan} plan is active.`);
          await load();
          onChange?.();
        }
      } catch {}
    }, 3000);
    return () => {
      alive = false;
      clearInterval(tick);
      clearInterval(check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr?.id]);

  const perMonth = plan ? Math.round(plan.price / plan.months) : 0;
  const save = plan && plan.strike > plan.price ? Math.round(((plan.strike - plan.price) / plan.strike) * 100) : 0;

  if (guest) {
    return (
      <div className="bl">
        <div className="bl-status">
          <i /> You are exploring as a guest.
        </div>
        <div className="bl-card">
          <h2 style={{ margin: 0 }}>Register your restaurant to choose a plan</h2>
          <p className="muted">Plans are for registered restaurants. Registering starts your free trial first, with nothing charged today.</p>
          <a className="primary" href="/apply" style={{ textAlign: "center", textDecoration: "none", display: "block", padding: "12px 0" }}>
            Register my restaurant
          </a>
          <a href="/plans" className="muted small" style={{ textAlign: "center" }}>
            See plans and pricing
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bl">
      <div className={sub?.status === "expired" ? "bl-status bad" : "bl-status"}>
        <i /> {status}
      </div>

      {trial && (sub?.status === "none" || !sub) && (
        <div className="bl-trial">
          <div className="n">
            <b>{trial.total}</b>
            <span>DAYS FREE</span>
          </div>
          <div>
            <strong>Free {trial.total}-day trial</strong>
            <p>
              {trial.base} days free + {trial.bonus} bonus days. Everything unlocked. Nothing is charged today.
            </p>
          </div>
        </div>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      {!plans && !error && <p className="muted">Loading the plans…</p>}

      {plans && plans.length > 1 && (
        <div className="ob-tabs" role="tablist">
          {plans.map((p) => (
            <button key={p.key} role="tab" aria-selected={picked === p.key} className={picked === p.key ? "on" : ""} onClick={() => setPicked(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      {plan && (
        <div className="bl-card">
          <div className="top">
            <span className="eyebrow">{plan.label.toUpperCase()}</span>
            {plan.best && <span className="best"><Crown size={13} /> BEST VALUE</span>}
          </div>
          <div className="price">
            <b>{inr(perMonth)}</b> <span>/ month</span>
          </div>
          <p className="muted">
            {plan.months === 1 ? "Billed monthly" : `Billed ${inr(plan.price)} for ${plan.months === 12 ? "12 months" : plan.months + " months"}`}
            {plan.blurb ? ` · ${plan.blurb}` : ""}
          </p>
          {save > 0 && (
            <p className="save">
              <s>{inr(plan.strike)}</s> <b>Save {inr(plan.strike - plan.price)} ({save}%)</b>
            </p>
          )}
          <ul>
            {FEATURES.map((f) => (
              <li key={f}>
                <Check size={16} /> {f}
              </li>
            ))}
          </ul>
          {payOnline ? (
            <>
              {qr ? (
                <div style={{ display: "grid", justifyItems: "center", gap: 8, padding: 14, border: "1px solid #f5d5c0", background: "#fff4ed", borderRadius: 16 }}>
                  <strong>Scan with any UPI app</strong>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr.img} alt={`UPI QR code for ${inr(plan.price)}`} width={220} height={220} style={{ background: "#fff", borderRadius: 12, padding: 8 }} />
                  <b style={{ fontSize: "1.3rem" }}>{inr(plan.price)}</b>
                  <span className="muted small">
                    {qr.expiresAt - now > 0
                      ? `Waiting for your payment… this code works for ${Math.floor((qr.expiresAt - now) / 60000)}:${String(Math.floor(((qr.expiresAt - now) % 60000) / 1000)).padStart(2, "0")} more`
                      : "This code has expired. Create a new one."}
                  </span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    {qr.expiresAt - now <= 0 ? (
                      <button className="primary" onClick={payQr}>New QR code</button>
                    ) : null}
                    <button className="secondary" onClick={() => setQr(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <button className="primary" disabled={busy} onClick={payQr}>
                    {busy ? "Preparing…" : `Pay ${inr(plan.price)} with UPI QR`}
                  </button>
                  <button className="secondary" disabled={busy} onClick={pay}>
                    Pay by card or net banking
                  </button>
                </>
              )}
              <p className="muted small">
                Secure payment by Razorpay: UPI, cards, net banking and wallets. Your plan switches on as soon as the payment goes through. Prices are in Indian rupees.
                {testMode ? " Test mode: no real money is taken." : ""}
              </p>
            </>
          ) : (
            <>
              <button className="primary" disabled={busy || requested === plan.key} onClick={request}>
                {requested === plan.key ? "Requested. We will contact you" : busy ? "Sending…" : `Request the ${plan.label} plan`}
              </button>
              <p className="muted small">Our team contacts you to complete payment, then activates it. Prices are in Indian rupees.</p>
            </>
          )}
        </div>
      )}
      {requested && plan && requested !== plan.key && <p className="muted">You asked for the {nameOf(requested)} plan. We will contact you to complete payment.</p>}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Check, Crown } from "lucide-react";
import { toast } from "sonner";

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

export default function Billing({ onChange }: { onChange?: () => void }) {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [trial, setTrial] = useState<{ base: number; bonus: number; total: number } | null>(null);
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/subscription", { cache: "no-store" });
      const d = (await r.json()) as any;
      if (!r.ok) throw new Error(d.error || "Could not load your plan");
      setPlans(d.plans);
      setSub(d.subscription);
      setTrial({ base: d.trialBaseDays, bonus: d.trialBonusDays, total: d.trialDays });
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

  const perMonth = plan ? Math.round(plan.price / plan.months) : 0;
  const save = plan && plan.strike > plan.price ? Math.round(((plan.strike - plan.price) / plan.strike) * 100) : 0;

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
          <button className="primary" disabled={busy || requested === plan.key} onClick={request}>
            {requested === plan.key ? "Requested. We will contact you" : busy ? "Sending…" : `Request the ${plan.label} plan`}
          </button>
          <p className="muted small">Our team contacts you to complete payment, then activates it. Prices are in Indian rupees.</p>
        </div>
      )}
      {requested && plan && requested !== plan.key && <p className="muted">You asked for the {nameOf(requested)} plan. We will contact you to complete payment.</p>}
    </div>
  );
}

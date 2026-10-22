"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, CreditCard, Sparkles, Utensils } from "lucide-react";
import { inr, PlanCards, PLAN_CSS, TrialGlow, type Plan, type Trial } from "../plan-cards";

const FEATURES = ["Unlimited orders and dishes", "Live order alerts on every phone", "Waiter accounts for your team", "Sales, dish performance and reviews", "Your QR code and menu link"];

// Plans and pricing, open to everyone, the same as the Plans screen in the app. Prices come from the plans the Super Admin
// manages, so a change there shows here at once. Paying happens inside the workspace, in Plan and billing.
export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [trial, setTrial] = useState<Trial | null>(null);
  const [guestDays, setGuestDays] = useState(7);
  const [picked, setPicked] = useState("");
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    fetch("/api/plans", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ plans?: Plan[]; trialDays?: number; trialBaseDays?: number; trialBonusDays?: number; guestDays?: number; error?: string }>)
      .then((d) => {
        if (!d.plans) throw new Error(d.error || "Could not load the plans.");
        setPlans(d.plans);
        setPicked((d.plans.find((p) => p.best) || d.plans[0])?.key || "");
        if (d.trialDays) setTrial({ base: d.trialBaseDays || 0, bonus: d.trialBonusDays || 0, total: d.trialDays });
        if (d.guestDays) setGuestDays(d.guestDays);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the plans."));
    // A manager who is already signed in gets a shortcut to pay.
    fetch("/api/app-config", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ guest?: boolean; subscription?: unknown }>) : null))
      .then((d) => setSignedIn(!!d && !d.guest))
      .catch(() => {});
  }, []);

  const plan = plans?.find((p) => p.key === picked);

  return (
    <div className="pl">
      <style>{PLAN_CSS + css}</style>
      <header className="pl-bar">
        <a className="pl-brand" href="/">
          <span className="pl-mark">
            <Utensils size={18} />
          </span>
          AS 426 <span>STUDIOS</span>
        </a>
        <a className="pl-link" href="/login">
          Team sign in <ArrowRight size={15} />
        </a>
      </header>

      <main className="pl-main">
        <section className="pl-hero">
          <span className="pl-eyebrow">PLANS AND PRICING</span>
          <h1>Choose how to start</h1>
          <p>Every restaurant starts with a free trial. Pick a plan whenever you are ready, and pay online by UPI, card or net banking.</p>
        </section>

        {error && <p className="pl-error">{error}</p>}
        {!plans && !error && <p className="pl-muted">Loading the plans…</p>}

        {trial && <TrialGlow trial={trial} on={false} onPick={() => (window.location.href = "/apply")} />}
        {plans && <PlanCards plans={plans} selected={picked} onPick={setPicked} label="Plans" />}

        {plan && (
          <section className="pl-card">
            <h2>
              {plan.label} · {inr(plan.price)}
            </h2>
            <p className="pl-muted">{plan.blurb || `Everything below, billed ${plan.months === 1 ? "monthly" : `for ${plan.months} months`}.`}</p>
            <ul>
              {FEATURES.map((f) => (
                <li key={f}>
                  <Check size={16} /> {f}
                </li>
              ))}
            </ul>
            <div className="pl-actions">
              <a className="pl-primary" href={`/apply?plan=${encodeURIComponent(plan.key)}`}>
                Start my free trial <ArrowRight size={16} />
              </a>
              {signedIn ? (
                <a className="pl-secondary" href="/team?tab=billing">
                  <CreditCard size={16} /> Pay for this plan
                </a>
              ) : (
                <a className="pl-secondary" href="/login">
                  Sign in to pay for a plan
                </a>
              )}
            </div>
            <p className="pl-fine">Nothing is charged today. Your free trial starts first, and we note the plan you picked. Prices are in Indian rupees.</p>
          </section>
        )}

        <section className="pl-card pl-guest">
          <Sparkles size={20} />
          <div>
            <strong>Just curious? Try it as a guest for {guestDays} days.</strong>
            <p className="pl-muted">Explore a sample restaurant with a sample menu and orders. No card needed.</p>
          </div>
          <a className="pl-secondary" href="/guest">
            Test as guest
          </a>
        </section>
      </main>

      <footer className="pl-foot">AS 426 Studios · Secure Restaurant Experience Platform
        <nav aria-label="Legal" style={{display:"flex",gap:16,flexWrap:"wrap",justifyContent:"center",marginTop:8}}><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/refunds">Refunds</a><a href="/contact">Contact</a></nav>
      </footer>
    </div>
  );
}

const css = `
.pl{--o:#c2410c;--od:#9a3412;--ink:#1c1917;--mut:#57534e;--line:#e8e6e2;min-height:100vh;background:linear-gradient(180deg,#fff 0,#f8f7f5 380px);color:var(--ink);font-family:"Manrope",system-ui,sans-serif}
.pl *{box-sizing:border-box}
.pl-bar{display:flex;justify-content:space-between;align-items:center;padding:16px clamp(16px,4vw,40px)}
.pl-brand{min-height:44px;display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:.04em;color:var(--ink);text-decoration:none}
.pl-brand span:last-child{color:var(--mut);font-weight:600}
.pl-mark{display:inline-flex;width:34px;height:34px;border-radius:10px;background:var(--o);color:#fff;align-items:center;justify-content:center}
.pl-link{min-height:44px;display:inline-flex;gap:6px;align-items:center;color:var(--od);font-weight:700;text-decoration:none;font-size:.92rem}
.pl-main{max-width:680px;margin:0 auto;padding:8px 16px 40px;display:grid;gap:16px}
.pl-hero{text-align:center;display:grid;gap:8px;padding:18px 0 6px}
.pl-eyebrow{font-size:.75rem;font-weight:700;letter-spacing:.18em;color:var(--o)}
.pl-hero h1{margin:0;font-family:"Michroma","Manrope",sans-serif;font-weight:400;font-size:clamp(1.5rem,4vw,2rem)}
.pl-hero p{margin:0 auto;max-width:520px;color:var(--mut);line-height:1.6}
.pl-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:22px;display:grid;gap:12px;box-shadow:0 4px 14px rgba(28,25,23,.05)}
.pl-card h2{margin:0;font-size:1.15rem}
.pl-card ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.pl-card li{display:flex;gap:10px;align-items:center;font-weight:600}.pl-card li svg{color:#166534;flex:none}
.pl-muted{color:var(--mut);margin:0;line-height:1.55}
.pl-fine{color:var(--mut);font-size:.82rem;margin:0;text-align:center}
.pl-error{color:#b91c1c;text-align:center}
.pl-actions{display:flex;gap:10px;flex-wrap:wrap}
.pl-primary,.pl-secondary{min-height:48px;padding:0 22px;border-radius:14px;display:inline-flex;gap:8px;align-items:center;justify-content:center;font-weight:800;text-decoration:none;font-size:.95rem}
.pl-primary{background:var(--o);color:#fff;flex:1 1 220px}
.pl-secondary{border:1.5px solid #f0b999;color:var(--od);background:#fff7f1}
.pl-guest{grid-template-columns:auto 1fr auto;align-items:center;background:#fff7f1;border-color:#f5d5c0}
.pl-guest svg{color:var(--o)}.pl-guest p{margin-top:2px}
@media(max-width:560px){.pl-guest{grid-template-columns:1fr;text-align:left}}
.pl-foot{text-align:center;color:var(--mut);font-size:.8rem;padding:24px 16px}
`;

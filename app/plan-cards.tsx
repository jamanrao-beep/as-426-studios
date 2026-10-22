"use client";

import { useEffect, useState } from "react";

// The free-trial card and the plan cards, shared by the Apply page and the public Plans page so they always look and
// work the same. The prices come from the plans in the database (GET /api/plans).
export const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
export type Plan = { key: string; label: string; price: number; strike: number; months: number; blurb: string; best: boolean };

export type Trial = { base: number; bonus: number; total: number };

// The free trial, as the server sets it (free days plus a welcome bonus). The number counts up and glows,
// and tapping the bonus chip sends a little burst of sparkles.
export function TrialGlow({ trial, on, onPick }: { trial: Trial; on: boolean; onPick: () => void }) {
  const [n, setN] = useState(0);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 1400);
      setN(Math.round(trial.total * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [trial.total]);
  return (
    <div className={`ap-trial ${on ? "on" : ""}`} onClick={onPick} role="button" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPick()}>
      <span className="ap-trial-rays" aria-hidden />
      <div className="ap-trial-num">
        <b>{n}</b>
        <span>DAYS FREE</span>
      </div>
      <div className="ap-trial-body">
        <strong>Start with a free {trial.total}-day trial</strong>
        <div className="ap-trial-chips">
          <span className="base">{trial.base} days free</span>
          <span className="plus">+</span>
          <button
            type="button"
            className="bonus"
            key={burst}
            onClick={(e) => {
              e.stopPropagation();
              setBurst((b) => b + 1);
            }}
          >
            {trial.bonus} BONUS days 🎁
            {burst > 0 && [0, 1, 2, 3, 4, 5].map((i) => <i key={i} style={{ ["--a" as any]: `${i * 60}deg` }} />)}
          </button>
        </div>
        <small>{burst > 0 ? "A welcome gift from us, no card and no catch." : "Everything unlocked. Nothing is charged today. Tap the bonus!"}</small>
      </div>
      {on && <span className="ap-trial-check">✓</span>}
    </div>
  );
}

export function PlanCards({ plans, selected, onPick, label = "Plans" }: { plans: Plan[]; selected: string; onPick: (key: string) => void; label?: string }) {
  return (
    <div className="ap-plans" role="radiogroup" aria-label={label}>
      {plans.map((p) => {
        const on = selected === p.key;
        const pct = p.strike > p.price ? Math.round(((p.strike - p.price) / p.strike) * 100) : 0;
        return (
          <button type="button" role="radio" aria-checked={on} key={p.key} className={`ap-plan ${on ? "on" : ""} ${p.best ? "best" : ""}`} onClick={() => onPick(p.key)}>
            {p.best && <b>★ BEST VALUE</b>}
            <i className="rd" aria-hidden />
            <span className="mid">
              <strong>{p.label}</strong>
              <small>
                {inr(p.price)} {p.months === 1 ? "billed monthly" : `for ${p.months === 12 ? "12 months" : p.months + " months"}`}
              </small>
              {pct > 0 && (
                <em>
                  <s>{inr(p.strike)}</s> <u>Save {inr(p.strike - p.price)} · {pct}%</u>
                </em>
              )}
            </span>
            <span className="pr">
              <big>{inr(Math.round(p.price / p.months))}</big>
              <small>per month</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// The styles for both. They use the page's --o (orange), --od, --ink, --mut and --line colours.
export const PLAN_CSS = `
.ap-trial-num b{font-family:"Michroma","Manrope",sans-serif}
.ap-plans{display:grid;grid-template-columns:1fr;gap:14px;padding-top:6px}
.ap-plan{position:relative;display:flex;align-items:center;gap:14px;text-align:left;border:1.5px solid var(--line);background:#fff;border-radius:18px;padding:16px 18px;min-height:76px;cursor:pointer;font:inherit;transition:border-color .15s,box-shadow .15s,transform .15s,background .15s}
.ap-plan .rd{flex:none;width:22px;height:22px;border-radius:50%;border:2px solid #a8a29e;display:grid;place-items:center;transition:all .15s}
.ap-plan.on .rd{border-color:var(--o);background:var(--o)}.ap-plan.on .rd::after{content:"";width:8px;height:8px;border-radius:50%;background:#fff}
.ap-plan .mid{flex:1;display:grid;gap:3px;min-width:0}.ap-plan .mid strong{font-size:1.05rem;font-weight:800}
.ap-plan .mid small{color:var(--mut);font-size:.82rem}
.ap-plan .mid em{font-style:normal;display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:.8rem;margin-top:2px}.ap-plan .mid em s{color:var(--mut)}
.ap-plan .mid em u{text-decoration:none;background:#dcfce7;color:#166534;font-weight:800;padding:2px 9px;border-radius:999px}
.ap-plan .pr{display:grid;justify-items:end;gap:0}.ap-plan .pr big{font-size:1.45rem;font-weight:800;line-height:1.15;color:var(--ink,#1c1917)}.ap-plan .pr small{color:var(--mut);font-size:.75rem}
.ap-plan b{position:absolute;top:-11px;right:16px;background:linear-gradient(135deg,#c2410c,#ea580c);color:#fff;border-radius:999px;font-size:.66rem;padding:4px 11px;letter-spacing:.08em;box-shadow:0 4px 10px rgba(194,65,12,.3)}
.ap-plan.best{border-color:#f0b999}
.ap-plan:hover{border-color:#ea8a58;transform:translateY(-1px)}.ap-plan.on{border-color:var(--o);background:#fff7f1;box-shadow:0 0 0 4px rgba(194,65,12,.12),0 10px 24px rgba(194,65,12,.12)}
.ap-trial{position:relative;overflow:hidden;display:flex;align-items:center;gap:18px;border:2px solid #f0b999;border-radius:18px;padding:18px 20px;background:linear-gradient(135deg,#fff7f1,#ffe9d9);cursor:pointer;animation:apglow 2.6s ease-in-out infinite;transition:transform .15s}
.ap-trial:hover{transform:translateY(-2px)}.ap-trial.on{border-color:var(--o)}
@keyframes apglow{0%,100%{box-shadow:0 0 0 0 rgba(194,65,12,.0),0 6px 18px rgba(194,65,12,.18)}50%{box-shadow:0 0 0 6px rgba(194,65,12,.12),0 10px 34px rgba(194,65,12,.45)}}
.ap-trial-rays{position:absolute;inset:-60%;background:conic-gradient(from 0deg,transparent 0 20deg,rgba(255,255,255,.55) 30deg,transparent 40deg 110deg,rgba(255,255,255,.45) 120deg,transparent 130deg 200deg,rgba(255,255,255,.5) 210deg,transparent 220deg 290deg,rgba(255,255,255,.4) 300deg,transparent 310deg);animation:apspin 9s linear infinite;pointer-events:none}
@keyframes apspin{to{transform:rotate(360deg)}}
.ap-trial-num{position:relative;flex:none;display:grid;justify-items:center;line-height:1;background:var(--o);color:#fff;border-radius:16px;padding:12px 16px;min-width:86px;box-shadow:0 0 24px rgba(194,65,12,.55);animation:appop 2.6s ease-in-out infinite}
@keyframes appop{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
.ap-trial-num b{font-size:2.4rem;font-weight:400;font-variant-numeric:tabular-nums}.ap-trial-num span{font-size:.62rem;letter-spacing:.12em;font-weight:600;margin-top:4px}
.ap-trial-body{position:relative;display:grid;gap:7px}.ap-trial-body strong{font-size:1.02rem}
.ap-trial-chips{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ap-trial-chips .base{background:#fff;border:1px solid #f0b999;border-radius:999px;padding:5px 11px;font-weight:600;font-size:.8rem;color:var(--od)}
.ap-trial-chips .plus{font-weight:600;color:var(--o)}
.ap-trial-chips .bonus{position:relative;border:0;cursor:pointer;background:linear-gradient(135deg,#ffb347,#df4d03);color:#fff;border-radius:999px;padding:6px 13px;font:inherit;font-weight:600;font-size:.8rem;animation:apwiggle 3.2s ease-in-out infinite}
@keyframes apwiggle{0%,86%,100%{transform:rotate(0)}90%{transform:rotate(-6deg) scale(1.08)}94%{transform:rotate(6deg) scale(1.08)}}
.ap-trial-chips .bonus i{position:absolute;left:50%;top:50%;width:7px;height:7px;border-radius:50%;background:#ffd34d;animation:apburst .8s ease-out forwards}
@keyframes apburst{from{transform:rotate(var(--a)) translateX(0);opacity:1}to{transform:rotate(var(--a)) translateX(46px);opacity:0}}
.ap-trial-body small{color:var(--mut);font-weight:600}
.ap-trial-check{position:absolute;top:10px;right:12px;width:24px;height:24px;border-radius:50%;background:var(--o);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:.8rem}
@media(max-width:480px){.ap-trial{flex-direction:column;text-align:center}.ap-trial-chips{justify-content:center}}
@media(max-width:420px){.ap-plan{padding:14px}.ap-plan .pr big{font-size:1.25rem}}
`;

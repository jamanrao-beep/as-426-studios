"use client";

import { useEffect, useState } from "react";
import { Copy, Mail, Rocket } from "lucide-react";
import { toast } from "sonner";
import EmailVerify from "../email-verify";

type Plan = { key: string; label: string; price: number; months: number; best: boolean };
type Done = { restaurantCode: string; loginEmail: string; temporaryPassword: string; mustChange: boolean; mailed: boolean; status: string; plan: string; endsAt: string | null };

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
const card = { background: "#fff", border: "1px solid #e7e5e4", borderRadius: 14, padding: 18, display: "grid", gap: 12 } as const;
const input = { width: "100%", minHeight: 44, padding: "0 12px", borderRadius: 10, border: "1px solid #d6d3d1", fontSize: "0.95rem", background: "#fff" } as const;
const label = { display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#57534e", marginBottom: 4 } as const;
const randomPassword = () => {
  const words = ["basil", "saffron", "mango", "ginger", "pepper", "lotus", "cumin", "clove"];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}-${pick()}-${Math.floor(100 + Math.random() * 900)}`;
};
const grid = { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" } as const;

// Super Admin: set a restaurant up by hand, just like approving a sign-up. Enter their details, choose whether they are
// on a free trial or already paid for a plan, and hand over the login. It lands in the same database as everything else,
// so the owner signs in and sees their restaurant straight away.
export default function Onboard({ onDone }: { onDone?: () => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [f, setF] = useState({ restaurantName: "", address: "", city: "", ownerName: "", phone: "", contactEmail: "", username: "", start: "trial" as "trial" | "paid", plan: "", password: "" });
  // By default they must choose their own password when they first sign in, and we email them the login.
  const [mustChange, setMustChange] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [showPw, setShowPw] = useState(false);
  // They read the 6-digit code from their own inbox (over the phone if they are not next to you).
  const [emailProof, setEmailProof] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    fetch("/api/plans", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ plans?: Plan[] }>)
      .then((d) => {
        setPlans(d.plans || []);
        setF((x) => ({ ...x, plan: x.plan || (d.plans?.find((p) => p.best) || d.plans?.[0])?.key || "" }));
      })
      .catch(() => {});
  }, []);

  const plan = plans.find((p) => p.key === f.plan);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.start === "paid" && !plan) return setError("Choose the plan they paid for.");
    if (!emailProof) return setError("Verify their email first: send the code and enter the 6 digits they read out.");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, username: f.username.trim().toLowerCase(), plan: f.plan || undefined, password: f.password.trim() || undefined, mustChange, sendEmail, emailProof }),
      });
      const d = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw new Error(d.error || "Could not set up the restaurant.");
      setDone({ restaurantCode: d.restaurantCode, loginEmail: d.loginEmail, temporaryPassword: d.temporaryPassword, mustChange: d.mustChange !== false, mailed: !!d.mail?.sent, status: d.subscription?.status, plan: d.subscription?.plan, endsAt: d.subscription?.endsAt });
      toast.success("Restaurant created.");
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set up the restaurant.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setDone(null);
    setF((x) => ({ ...x, restaurantName: "", address: "", city: "", ownerName: "", phone: "", contactEmail: "", username: "", password: "" }));
  }

  if (done) {
    const text = `Table Secret login\nRestaurant code: ${done.restaurantCode}\nUsername: ${done.loginEmail.split("@")[0]}\nLogin ID: ${done.loginEmail}\n${done.mustChange ? "Temporary password" : "Password"}: ${done.temporaryPassword}\n\nSign in on the website or in the app.${done.mustChange ? " You will choose your own password first." : " You can change it any time."}`;
    return (
      <div style={{ ...card, maxWidth: 640, borderColor: "#bbf7d0", background: "#f0fdf4" }}>
        <strong style={{ fontSize: "1.1rem" }}>Restaurant is ready</strong>
        <p style={{ margin: 0, color: "#475569", fontSize: "0.9rem", lineHeight: 1.6 }}>
          {done.status === "active" ? `They are on the ${done.plan} plan until ${done.endsAt ? new Date(done.endsAt).toLocaleDateString("en-IN", { dateStyle: "long" }) : "—"}.` : `They are on a free trial until ${done.endsAt ? new Date(done.endsAt).toLocaleDateString("en-IN", { dateStyle: "long" }) : "—"}.`}{" "}
          {done.mailed ? "We emailed the login to them." : "No email was sent, so give them these details yourself."} {done.mustChange ? "They must choose their own password when they first sign in." : "They can keep this password, and change it any time from the Password button."}
        </p>
        <div style={{ fontFamily: "monospace", background: "#fff", border: "1px solid #bbf7d0", borderRadius: 10, padding: 12, lineHeight: 1.8, overflowWrap: "anywhere" }}>
          Restaurant code: {done.restaurantCode}
          <br />
          Username: {done.loginEmail.split("@")[0]}
          <br />
          Login ID: {done.loginEmail}
          <br />
          {done.mustChange ? "Temporary password" : "Password"}: {done.temporaryPassword}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="secondary" onClick={() => navigator.clipboard?.writeText(text).then(() => toast.success("Copied"))}>
            <Copy size={14} /> Copy details
          </button>
          <button type="button" className="primary" onClick={reset}>
            Set up another restaurant
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ ...card, maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Rocket size={18} color="#9a3412" />
        <strong style={{ fontSize: "1.05rem" }}>Set up a restaurant by hand</strong>
      </div>
      <p style={{ margin: 0, color: "#57534e", fontSize: "0.88rem", lineHeight: 1.55 }}>
        For a restaurant you signed up in person or over the phone. Enter their details, say whether they are on a free trial or have already paid, and we create their account and email them the login.
      </p>

      <div style={grid}>
        <div>
          <label style={label}>Restaurant name *</label>
          <input style={input} required value={f.restaurantName} onChange={(e) => set("restaurantName", e.target.value)} placeholder="e.g. Spice Route" />
        </div>
        <div>
          <label style={label}>Street address *</label>
          <input style={input} required value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="12 MG Road" />
        </div>
        <div>
          <label style={label}>City *</label>
          <input style={input} required value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Pune" />
        </div>
        <div>
          <label style={label}>Owner or manager name *</label>
          <input style={input} required value={f.ownerName} onChange={(e) => set("ownerName", e.target.value)} placeholder="Asha Rao" />
        </div>
        <div>
          <label style={label}>Mobile number *</label>
          <input style={input} required value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="98765 43210" inputMode="tel" />
        </div>
        <div>
          <label style={label}>Their email (Gmail) *</label>
          <input style={input} required type="email" value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} placeholder="asha@gmail.com" />
          <small style={{ color: "#78716c" }}>Login details are sent here. We check the address with a code, which they read out to you.</small>
          <EmailVerify email={f.contactEmail} onProof={setEmailProof} />
        </div>
        <div>
          <label style={label}>Their username *</label>
          <input style={input} required maxLength={30} value={f.username} onChange={(e) => set("username", e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))} placeholder="e.g. asha" />
          <small style={{ color: "#78716c" }}>They sign in as {f.username || "username"}@(restaurant code).as426studios.com</small>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <span style={label}>What are they on?</span>
        <div className="ob-tabs" role="radiogroup" style={{ maxWidth: 420 }}>
          <button type="button" role="radio" aria-checked={f.start === "trial"} className={f.start === "trial" ? "on" : ""} onClick={() => set("start", "trial")}>
            Free trial
          </button>
          <button type="button" role="radio" aria-checked={f.start === "paid"} className={f.start === "paid" ? "on" : ""} onClick={() => set("start", "paid")}>
            Already paid
          </button>
        </div>
        <div style={{ ...grid, alignItems: "end" }}>
          <div>
            <label style={label}>{f.start === "paid" ? "Plan they paid for *" : "Plan they are interested in (optional)"}</label>
            <select style={input} value={f.plan} onChange={(e) => set("plan", e.target.value)}>
              {f.start === "trial" && <option value="">No plan chosen yet</option>}
              {plans.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label} · {inr(p.price)}
                </option>
              ))}
            </select>
          </div>
          <p style={{ margin: 0, color: "#57534e", fontSize: "0.85rem", lineHeight: 1.5 }}>
            {f.start === "paid"
              ? `The ${plan?.label || "chosen"} plan starts now and the payment is recorded as taken by you. No free trial is added.`
              : "They get the free trial first. If you pick a plan, we note it as the one they asked for."}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10, background: "#fafaf9", borderRadius: 12, padding: 14 }}>
        <span style={label}>Password</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            style={{ ...input, flex: "1 1 220px", fontFamily: showPw ? "monospace" : undefined }}
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            value={f.password}
            onChange={(e) => set("password", e.target.value)}
            placeholder="Leave empty to make one for them"
          />
          <button type="button" className="secondary" onClick={() => setShowPw((v) => !v)}>
            {showPw ? "Hide" : "Show"}
          </button>
          <button type="button" className="secondary" onClick={() => { setShowPw(true); set("password", randomPassword()); }}>
            Generate
          </button>
        </div>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontWeight: 600, cursor: f.password.trim() ? "pointer" : "default", opacity: f.password.trim() ? 1 : 0.6 }}>
          <input type="checkbox" checked={f.password.trim() ? mustChange : true} disabled={!f.password.trim()} onChange={(e) => setMustChange(e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            They must choose their own password when they first sign in
            <small style={{ display: "block", fontWeight: 400, color: "#78716c" }}>{f.password.trim() ? "Turn this off only if they should keep the password you set." : "A password we make up is always temporary."}</small>
          </span>
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontWeight: 600, cursor: "pointer" }}>
          <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            Email them the login details now
            <small style={{ display: "block", fontWeight: 400, color: "#78716c" }}>Turn off to give the details yourself later. The login and password still appear on the next screen.</small>
          </span>
        </label>
      </div>

      {error ? <p style={{ color: "#b91c1c", margin: 0 }}>{error}</p> : null}
      <button type="submit" disabled={busy} style={{ minHeight: 46, padding: "0 24px", borderRadius: 12, border: 0, background: "#c2410c", color: "#fff", fontWeight: 800, cursor: "pointer", justifySelf: "start", display: "inline-flex", gap: 8, alignItems: "center", opacity: busy ? 0.7 : 1 }}>
        <Mail size={16} /> {busy ? "Creating…" : "Create restaurant and send login"}
      </button>
    </form>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Lock, Mail, Phone, Sparkles, User } from "lucide-react";

// "Test as guest" on the website, the same as in the app: tell us who you are, prove your email with a 6-digit code, and
// you get a sample restaurant for your guest week. One guest week per email.
export default function GuestPage() {
  const [step, setStep] = useState<"details" | "code">("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [wait, setWait] = useState(0);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetch("/api/plans", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ guestDays?: number }>)
      .then((d) => d.guestDays && setDays(d.guestDays))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (name.trim().length < 2) return setError("Enter your name.");
    if (phone.trim().length < 6) return setError("Enter a phone number we can reach you on.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address, like you@gmail.com.");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/guest/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim().toLowerCase() }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; devCode?: string };
      if (!res.ok) throw new Error(d.error || "Could not send the code.");
      setHint(d.devCode ? `Test mode: your code is ${d.devCode}` : "");
      setCode("");
      setStep("code");
      setWait(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return setError("Enter all 6 digits.");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code, name: name.trim(), phone: phone.trim() }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "That code did not work.");
      window.location.href = "/team";
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code did not work.");
      setBusy(false);
    }
  }

  return (
    <div className="login-container">
      <header className="brandbar login-brandbar">
        <a className="brand" href="/">
          <span className="brandmark">TS</span>AS 426 <span className="muted">STUDIOS</span>
        </a>
        <a className="quiet-link" href="/login">
          Sign in
        </a>
      </header>
      <div className="login-card">
        <div className="login-header">
          <span className="pill login-pill">
            <Sparkles size={12} />
            GUEST WEEK
          </span>
          <h1>{step === "details" ? "Try Table Secret as a guest" : "Check your email"}</h1>
          <p>
            {step === "details"
              ? `Explore a sample restaurant for your ${days}-day guest week. Tell us who you are and confirm your email first.`
              : `We sent a 6-digit code to ${email.trim().toLowerCase()}. It can take a minute.`}
          </p>
        </div>

        {error && (
          <div className="error login-error" role="alert">
            {error}
          </div>
        )}

        {step === "details" ? (
          <form className="login-form" onSubmit={sendCode}>
            <label>
              Your name
              <div className="input-wrap">
                <User size={16} className="input-icon" />
                <input autoComplete="name" placeholder="Asha Rao" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            </label>
            <label>
              Phone number
              <div className="input-wrap">
                <Phone size={16} className="input-icon" />
                <input type="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </label>
            <label>
              Your Gmail or work email
              <div className="input-wrap">
                <Mail size={16} className="input-icon" />
                <input type="email" autoComplete="email" autoCapitalize="none" placeholder="you@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </label>
            <button type="submit" className="primary login-submit" disabled={busy}>
              {busy ? "Sending…" : "Send me a code"}
            </button>
            <p className="muted small">We only use these details to reply to you and help you get started.</p>
            <div className="bl-trial" style={{ marginTop: 4 }}>
              <div>
                <strong>What you get</strong>
                <p>A sample menu and orders to try, one staff account and every report. Registering your own restaurant unlocks the rest and starts your free trial.</p>
              </div>
            </div>
          </form>
        ) : (
          <form className="login-form" onSubmit={verify}>
            <label>
              6-digit code
              <div className="input-wrap">
                <Lock size={16} className="input-icon" />
                <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              </div>
            </label>
            {hint && <p className="muted small">{hint}</p>}
            <button type="submit" className="primary login-submit" disabled={busy}>
              {busy ? "Checking…" : "Verify and enter"}
            </button>
            <button type="button" className="secondary" disabled={busy || wait > 0} onClick={() => sendCode()}>
              {wait > 0 ? `Send again in ${wait}s` : "Send the code again"}
            </button>
            <button type="button" className="secondary" onClick={() => setStep("details")}>
              Use a different email
            </button>
          </form>
        )}

        <a className="apply-cta" href="/login">
          <span>
            <strong>
              <ArrowLeft size={14} style={{ verticalAlign: "-2px" }} /> Back to sign in
            </strong>
          </span>
        </a>
      </div>
      <footer className="login-page-footer">
        AS 426 Studios · Secure Restaurant Experience Platform
        <nav aria-label="Legal" style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/refunds">Refunds</a>
          <a href="/contact">Contact</a>
        </nav>
      </footer>
    </div>
  );
}

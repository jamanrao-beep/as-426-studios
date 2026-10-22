"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Lock, Mail } from "lucide-react";

// Forgot password: give the restaurant code and username, get a 6-digit code by email, choose a new password.
export default function ForgotPassword() {
  const [step, setStep] = useState<"ask" | "code" | "done">("ask");
  const [restaurant, setRestaurant] = useState("");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [devCode, setDevCode] = useState("");
  const [wait, setWait] = useState(0);

  useEffect(() => {
    try {
      setRestaurant(localStorage.getItem("ts_restaurant_code") || "");
    } catch {}
  }, []);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const who = { restaurant: restaurant.trim().toLowerCase(), username: username.trim() };

  async function ask(e?: React.FormEvent) {
    e?.preventDefault();
    if (!who.username) return setError("Enter your username or login ID.");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(who) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; message?: string; devCode?: string };
      if (!res.ok) throw new Error(d.error || "Could not send the code.");
      setNote(d.message || "");
      setDevCode(d.devCode || "");
      setStep("code");
      setWait(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return setError("Enter the 6-digit code from your email.");
    if (pw.length < 6) return setError("Your new password needs at least 6 characters.");
    if (pw !== pw2) return setError("The two passwords do not match.");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...who, code, newPassword: pw }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "Could not reset the password.");
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-card">
      <div className="login-header">
        <span className="pill login-pill">
          <KeyRound size={12} />
          RESET YOUR PASSWORD
        </span>
        <h1>{step === "done" ? "Password changed" : "Forgot your password?"}</h1>
        <p>
          {step === "ask" && "Tell us who you are and we will email a 6-digit code to the address we have on file."}
          {step === "code" && "Check your email for the code, then choose a new password."}
          {step === "done" && "You can sign in with your new password now."}
        </p>
      </div>

      {error && (
        <div className="error login-error" role="alert">
          {error}
        </div>
      )}

      {step === "ask" && (
        <form className="login-form" onSubmit={ask}>
          <label>
            Restaurant code
            <div className="input-wrap">
              <Mail size={16} className="input-icon" />
              <input type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="e.g. spice-route" value={restaurant} onChange={(e) => setRestaurant(e.target.value.replace(/\s/g, ""))} />
            </div>
            <small className="muted">Leave empty if you type your full login ID below.</small>
          </label>
          <label>
            Username or login ID
            <div className="input-wrap">
              <Mail size={16} className="input-icon" />
              <input type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="e.g. rahul" value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))} />
            </div>
          </label>
          <button type="submit" className="primary login-submit" disabled={busy}>
            {busy ? "Sending…" : "Email me a code"}
          </button>
          <p className="muted small">Waiters do not have an email of their own: ask your manager to reset your password.</p>
        </form>
      )}

      {step === "code" && (
        <form className="login-form" onSubmit={reset}>
          {note && <p className="muted">{note}</p>}
          {devCode && <p className="muted small">Test mode: the code is {devCode}</p>}
          <label>
            6-digit code
            <div className="input-wrap">
              <KeyRound size={16} className="input-icon" />
              <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            </div>
          </label>
          <label>
            New password
            <div className="input-wrap">
              <Lock size={16} className="input-icon" />
              <input type={show ? "text" : "password"} autoComplete="new-password" placeholder="At least 6 characters" value={pw} onChange={(e) => setPw(e.target.value)} />
              <button type="button" className="password-toggle" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <label>
            Confirm new password
            <div className="input-wrap">
              <Lock size={16} className="input-icon" />
              <input type={show ? "text" : "password"} autoComplete="new-password" placeholder="Type it again" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
          </label>
          <button type="submit" className="primary login-submit" disabled={busy}>
            {busy ? "Saving…" : "Change my password"}
          </button>
          <button type="button" className="secondary" disabled={busy || wait > 0} onClick={() => ask()}>
            {wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
          </button>
        </form>
      )}

      {step === "done" && (
        <div className="login-form">
          <p style={{ display: "flex", gap: 8, alignItems: "center", color: "#166534", fontWeight: 700 }}>
            <CheckCircle2 size={18} /> Your password was changed and you were signed out of other devices.
          </p>
          <a className="primary login-submit" href="/login" style={{ textAlign: "center", textDecoration: "none" }}>
            Go to sign in
          </a>
        </div>
      )}

      {step !== "done" && (
        <a className="apply-cta" href="/login">
          <span>
            <strong>
              <ArrowLeft size={14} style={{ verticalAlign: "-2px" }} /> Back to sign in
            </strong>
          </span>
        </a>
      )}
    </div>
  );
}

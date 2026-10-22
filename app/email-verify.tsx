"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";

// Proves an email address belongs to the person typing it: we email a 6-digit code, they type it in, and the form gets
// back a proof token to send with the address. Changing the address clears the proof, so a verified address can never be
// swapped for another.
export default function EmailVerify({ email, onProof, accent = "#c2410c" }: { email: string; onProof: (proof: string) => void; accent?: string }) {
  const clean = email.trim().toLowerCase();
  const valid = /^\S+@\S+\.\S+$/.test(clean);
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState("");
  const [wait, setWait] = useState(0);

  // A different address starts again.
  useEffect(() => {
    if (clean !== sentTo && clean !== verified) {
      setSentTo("");
      setCode("");
      setVerified("");
      setError("");
      setDevCode("");
      onProof("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clean]);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function send() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/email/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: clean }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; devCode?: string };
      if (!res.ok) throw new Error(d.error || "Could not send the code.");
      setSentTo(clean);
      setDevCode(d.devCode || "");
      setWait(60);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/email/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: clean, code: code.trim() }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; proof?: string };
      if (!res.ok || !d.proof) throw new Error(d.error || "That code is not right.");
      setVerified(clean);
      onProof(d.proof);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check the code.");
    } finally {
      setBusy(false);
    }
  }

  if (verified && verified === clean) {
    return (
      <div role="status" style={{ display: "flex", gap: 8, alignItems: "center", color: "#166534", fontWeight: 700, fontSize: "0.88rem", margin: "6px 0" }}>
        <CheckCircle2 size={16} /> Email verified
      </div>
    );
  }
  if (!valid) return null;

  const btn = { minHeight: 40, padding: "0 16px", borderRadius: 10, border: 0, background: accent, color: "#fff", fontWeight: 800, cursor: "pointer" } as const;
  return (
    <div style={{ display: "grid", gap: 8, margin: "8px 0", padding: 12, border: "1px solid #f5d5c0", background: "#fff7f1", borderRadius: 12 }}>
      {sentTo !== clean ? (
        <>
          <span style={{ fontSize: "0.85rem", color: "#57534e" }}>We need to check that this email is really yours. We will send a 6-digit code to it.</span>
          <div>
            <button type="button" style={{ ...btn, display: "inline-flex", gap: 6, alignItems: "center", opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={send}>
              <Mail size={15} /> {busy ? "Sending…" : "Send me a code"}
            </button>
          </div>
        </>
      ) : (
        <>
          <span style={{ fontSize: "0.85rem", color: "#57534e" }}>
            We sent a 6-digit code to <b>{clean}</b>. It works for 10 minutes. Check your spam folder too.
          </span>
          {devCode ? <span style={{ fontSize: "0.8rem", color: "#92400e" }}>Test mode: the code is {devCode}</span> : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              style={{ flex: "1 1 140px", minHeight: 40, padding: "0 12px", borderRadius: 10, border: "1px solid #d6d3d1", letterSpacing: 4, fontWeight: 700 }}
            />
            <button type="button" style={{ ...btn, opacity: busy || code.length !== 6 ? 0.6 : 1 }} disabled={busy || code.length !== 6} onClick={verify}>
              {busy ? "Checking…" : "Verify"}
            </button>
            <button type="button" style={{ ...btn, background: "#fff", color: "#57534e", border: "1px solid #d6d3d1" }} disabled={busy || wait > 0} onClick={send}>
              {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
            </button>
          </div>
        </>
      )}
      {error ? (
        <span role="alert" style={{ color: "#b91c1c", fontSize: "0.85rem" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

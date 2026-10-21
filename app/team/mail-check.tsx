"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";

// Email sending, checked in one click. Approval emails, guest codes and replies all depend on it, and the reason
// it fails (usually a Gmail App password) is shown here in plain words instead of hiding in a server log.
type Status = { configured: boolean; user: string; passLength: number; host: string };

export default function MailCheck() {
  const [status, setStatus] = useState<Status | null>(null);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/mail-test", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: any) => d && setStatus(d as Status))
      .catch(() => {});
  }, []);

  async function test() {
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch("/api/admin/mail-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to }) });
      const d = (await r.json()) as any;
      if (!r.ok) throw new Error(d.error || "Could not run the test");
      setResult(d.sent ? { ok: true, text: `Sent. Check the inbox of ${to}. Email is working.` } : { ok: false, text: d.reason || "The email was not sent." });
      if (d.status) setStatus(d.status);
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : "Could not run the test" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-panel" style={{ display: "grid", gap: 10, maxWidth: 720, marginBottom: 22 }}>
      <span className="access-badge">
        <Mail size={16} /> EMAIL SENDING
      </span>
      <p className="muted" style={{ margin: 0 }}>
        {status
          ? status.configured
            ? `Sending as ${status.user} through ${status.host} (password set, ${status.passLength} characters). A Gmail App password is 16 characters.`
            : "Email is not set up. Add MAIL_USER and MAIL_PASS (a Gmail App password) in the server settings, then redeploy."
          : "Checking…"}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Send a test email to…" aria-label="Test email address" style={{ flex: 1, minWidth: 220 }} />
        <button className="primary" disabled={busy || !/^\S+@\S+\.\S+$/.test(to)} onClick={test}>
          {busy ? "Sending…" : "Send test email"}
        </button>
      </div>
      {result && (
        <p role="status" style={{ margin: 0, padding: "10px 14px", borderRadius: 12, background: result.ok ? "#dcfce7" : "#fee2e2", color: result.ok ? "#166534" : "#991b1b" }}>
          {result.text}
        </p>
      )}
    </div>
  );
}

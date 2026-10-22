"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";

// Email sending, checked in one click. Approval emails, guest codes and replies all depend on it, and the reason
// it fails (usually a Gmail App password) is shown here in plain words instead of hiding in a server log.
type Status = { configured: boolean; user: string; passLength: number; host: string };

function MailTest() {
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

type Diagnosis = {
  found: boolean;
  login?: string;
  role?: string;
  reason: string;
  explanation: string;
  emailOnFile?: string | null;
  mailConfigured?: boolean;
  lastCodeSentAt?: string | null;
  codesInLastHour?: number;
  limitNote?: string;
};

// "Forgot password" answers the same way for everyone so strangers cannot learn who has an account. That also hides the
// reason a code did not arrive, so the real reason is shown here, to the Super Admin only.
function ResetDiagnosis() {
  const [who, setWho] = useState("");
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState<Diagnosis | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  async function run(extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/email-diagnose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: who.trim(), ...extra }) });
      const j = (await r.json()) as any;
      if (!r.ok) throw new Error(j.error || "Could not check that account.");
      setD(j);
      if (extra.setEmail) setEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check that account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-panel" style={{ display: "grid", gap: 10, maxWidth: 720, marginBottom: 22 }}>
      <span className="access-badge">
        <Mail size={16} /> WHY DIDN&apos;T A RESET CODE ARRIVE?
      </span>
      <p className="muted" style={{ margin: 0 }}>
        Type the login that asked for the code, for example <b>rahul@spice-route</b> (an older account: <b>name@as426studios.com</b>). We show the real reason.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={who} onChange={(e) => setWho(e.target.value.replace(/\s/g, ""))} placeholder="username@restaurant-code" aria-label="Login to check" style={{ flex: 1, minWidth: 220 }} />
        <button className="primary" disabled={busy || !who.trim()} onClick={() => run()}>
          {busy ? "Checking…" : "Check"}
        </button>
      </div>
      {error && <p style={{ margin: 0, color: "#991b1b" }}>{error}</p>}
      {d && (
        <div role="status" style={{ display: "grid", gap: 6, padding: "12px 14px", borderRadius: 12, background: d.reason === "ok" ? "#dcfce7" : "#fef3c7", color: d.reason === "ok" ? "#166534" : "#92400e" }}>
          <strong>{d.reason === "ok" ? "A code would be sent" : "No code is sent for this login"}</strong>
          <span>{d.explanation}</span>
          {d.emailOnFile ? <span>Email on file: <b>{d.emailOnFile}</b></span> : null}
          {d.reason === "ok" && d.mailConfigured === false ? <span><b>But email sending is not set up on the server</b>, so nothing can go out. Fix that above first.</span> : null}
          {d.lastCodeSentAt ? <span>Last code sent: {new Date(d.lastCodeSentAt).toLocaleString("en-IN")} · {d.codesInLastHour} in the last hour</span> : null}
          {d.limitNote ? <span><b>{d.limitNote}</b></span> : null}
          {d.reason === "no_contact" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their real email" aria-label="Email to attach" style={{ flex: 1, minWidth: 200 }} />
              <button className="primary" disabled={busy || !/^\S+@\S+\.\S+$/.test(email)} onClick={() => run({ setEmail: email })}>
                Attach this email
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Sent = { to: string; subject: string; sent: boolean; reason: string | null; at: string };

// The last emails the server tried to send. An email that is not in this list was never attempted; one that failed shows
// why. It updates while this screen is open.
function RecentEmails() {
  const [rows, setRows] = useState<Sent[] | null>(null);
  const load = () =>
    fetch("/api/admin/mail-log", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ emails: Sent[] }>) : null))
      .then((d) => d && setRows(d.emails))
      .catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="form-panel" style={{ display: "grid", gap: 8, maxWidth: 720, marginBottom: 22 }}>
      <span className="access-badge">
        <Mail size={16} /> RECENT EMAILS
      </span>
      <p className="muted" style={{ margin: 0 }}>
        Every email the server tried to send, newest first. If someone says an email did not arrive, look for it here: <b>Sent</b> means Gmail accepted it (check their spam folder), a red row shows why it failed, and no row means it was never tried.
      </p>
      {rows === null ? <p className="muted">Loading…</p> : null}
      {rows && !rows.length ? <p className="muted">Nothing sent yet.</p> : null}
      {rows?.map((r, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", borderTop: "1px solid #eee", paddingTop: 6 }}>
          <span style={{ minWidth: 0 }}>
            <b style={{ overflowWrap: "anywhere" }}>{r.to}</b>
            <br />
            <small className="muted">
              {r.subject} · {new Date(r.at).toLocaleString("en-IN")}
            </small>
            {!r.sent && r.reason ? (
              <>
                <br />
                <small style={{ color: "#991b1b" }}>{r.reason}</small>
              </>
            ) : null}
          </span>
          <span className="tiny-badge" style={{ alignSelf: "flex-start", background: r.sent ? "#dcfce7" : "#fee2e2", color: r.sent ? "#166534" : "#991b1b" }}>
            {r.sent ? "SENT" : "FAILED"}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function MailCheck() {
  return (
    <>
      <MailTest />
      <ResetDiagnosis />
      <RecentEmails />
    </>
  );
}

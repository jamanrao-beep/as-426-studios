"use client";

import { useCallback, useEffect, useState } from "react";
import { shortLogin } from "@/lib/login-id";
import { Check, Copy, Send, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import EmailVerify from "../email-verify";

type Proposal = {
  id: string;
  restaurant_id: string;
  restaurant_name: string | null;
  proposed_by: string;
  proposer_name: string | null;
  name: string;
  username: string;
  contact_email: string;
  phone: string | null;
  status: "pending" | "approving" | "approved" | "rejected";
  note: string | null;
  login_email: string | null;
  created_at: string;
};

async function call(method: string, body?: unknown) {
  const res = await fetch("/api/manager-proposals", { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const card = { background: "#fff", border: "1px solid #e7e5e4", borderRadius: 14, padding: 18 } as const;
const input = { width: "100%", minHeight: 44, padding: "0 12px", borderRadius: 10, border: "1px solid #d6d3d1", fontSize: "0.95rem", background: "#fff" } as const;
const label = { display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#57534e", marginBottom: 4 } as const;

function Status({ s }: { s: Proposal["status"] }) {
  const t = s === "approved" ? { bg: "#dcfce7", fg: "#166534", l: "APPROVED" } : s === "rejected" ? { bg: "#fee2e2", fg: "#991b1b", l: "NOT APPROVED" } : { bg: "#fff1e8", fg: "#9a3412", l: "WAITING" };
  return <span style={{ background: t.bg, color: t.fg, fontSize: "0.7rem", fontWeight: 800, letterSpacing: 0.6, padding: "3px 8px", borderRadius: 999 }}>{t.l}</span>;
}

// A manager can propose another manager for their restaurant; the Super Admin approves or declines. Waiters are
// different: a manager adds those directly, with no approval.
export default function ManagerProposals({ owner, restaurantCode = "", onChange }: { owner: boolean; restaurantCode?: string; onChange?: () => void }) {
  const [rows, setRows] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [emailProof, setEmailProof] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});
  const [pws, setPws] = useState<Record<string, string>>({});
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Is this username free at the restaurant? Two people there cannot share one; other restaurants do not matter.
  useEffect(() => {
    const u = username.trim().toLowerCase();
    if (owner || !u || !restaurantCode) return setNameMsg(null);
    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(u)) return setNameMsg({ ok: false, text: "Use 3 to 30 letters, numbers, dots or dashes." });
    setNameMsg({ ok: true, text: "Checking…" });
    const t = setTimeout(() => {
      fetch(`/api/usernames/check?username=${encodeURIComponent(u)}`, { cache: "no-store" })
        .then((r) => r.json() as Promise<{ available?: boolean; reason?: string }>)
        .then((d) => setNameMsg(d.available ? { ok: true, text: `${u} is free at your restaurant ✓` } : d.reason ? { ok: false, text: d.reason } : null))
        .catch(() => setNameMsg(null));
    }, 450);
    return () => clearTimeout(t);
  }, [username, owner, restaurantCode]);
  const [issued, setIssued] = useState<{ loginEmail: string; temporaryPassword: string; mailed: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await call("GET");
      setRows(d.proposals || []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load requests.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function propose(e: React.FormEvent) {
    e.preventDefault();
    setBusy("new");
    try {
      if (!emailProof) throw new Error("Verify their email first: send the code to it, then enter the 6 digits they read out to you.");
      await call("POST", { action: "propose", name, username, contactEmail, emailProof, phone: phone || undefined });
      toast.success("Request sent. The Super Admin will review it.");
      setName("");
      setUsername("");
      setContactEmail("");
      setPhone("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the request.");
    } finally {
      setBusy("");
    }
  }

  async function decide(id: string, action: "approve" | "reject") {
    setBusy(id);
    try {
      const d = await call("POST", { action, id, note: note[id] || undefined, password: action === "approve" ? pws[id]?.trim() || undefined : undefined });
      if (action === "approve") {
        setIssued({ loginEmail: d.loginEmail, temporaryPassword: d.temporaryPassword, mailed: !!d.mail?.sent });
        toast.success("Manager account created.");
      } else toast.success("Request declined.");
      await load();
      onChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save that decision.");
      load();
    } finally {
      setBusy("");
    }
  }

  const pending = rows.filter((r) => r.status === "pending");
  const history = rows.filter((r) => r.status !== "pending");

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 760 }}>
      {issued ? (
        <div style={{ ...card, borderColor: "#bbf7d0", background: "#f0fdf4" }}>
          <strong>Manager account created</strong>
          <p style={{ margin: "6px 0", color: "#475569", fontSize: "0.9rem" }}>
            {issued.mailed ? "We emailed these details to them." : "The email could not be sent, so share these details with them yourself."} The password works once and they must change it when they sign in.
          </p>
          <div style={{ fontFamily: "monospace", background: "#fff", border: "1px solid #bbf7d0", borderRadius: 10, padding: 12, lineHeight: 1.7 }}>
            Login ID: {shortLogin(issued.loginEmail)}
            <br />
            Restaurant code: {issued.loginEmail.split("@")[1]?.replace(".as426studios.com", "")}
            <br />
            Temporary password: {issued.temporaryPassword}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" onClick={() => navigator.clipboard?.writeText(`Login ID: ${shortLogin(issued.loginEmail)}\nRestaurant code: ${issued.loginEmail.split("@")[1]?.replace(".as426studios.com", "")}\nTemporary password: ${issued.temporaryPassword}`).then(() => toast.success("Copied"))} style={{ ...input, width: "auto", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
              <Copy size={14} /> Copy
            </button>
            <button type="button" onClick={() => setIssued(null)} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 700 }}>
              Done
            </button>
          </div>
        </div>
      ) : null}

      {!owner ? (
        <form onSubmit={propose} style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <UserPlus size={18} color="#9a3412" />
            <strong style={{ fontSize: "1.05rem" }}>Ask for another manager</strong>
          </div>
          <p style={{ margin: "0 0 14px", color: "#57534e", fontSize: "0.88rem", lineHeight: 1.55 }}>
            A new manager can run the restaurant with you. The Super Admin checks every request before the account is made. To add a waiter, no approval is needed: use Manage waiters.
          </p>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div>
              <label style={label}>Their name</label>
              <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Sharma" required />
            </div>
            <div>
              <label style={label}>Username they will use</label>
              <input style={input} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="e.g. rahul.spiceroute" required />
              <small style={{ color: nameMsg ? (nameMsg.ok ? "#166534" : "#b91c1c") : "#78716c", fontWeight: nameMsg ? 700 : 400 }}>{nameMsg ? nameMsg.text : `They sign in as ${username || "username"}@${restaurantCode || "restaurant-code"}`}</small>
            </div>
            <div>
              <label style={label}>Their real email</label>
              <input style={input} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="rahul@gmail.com" required />
              <small style={{ color: "#78716c" }}>Login details are sent here once approved.</small>
              <EmailVerify email={contactEmail} onProof={setEmailProof} />
            </div>
            <div>
              <label style={label}>Phone (optional)</label>
              <input style={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" />
            </div>
          </div>
          <button type="submit" disabled={busy === "new"} style={{ marginTop: 14, minHeight: 44, padding: "0 22px", borderRadius: 12, border: 0, background: "#c2410c", color: "#fff", fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, opacity: busy === "new" ? 0.7 : 1 }}>
            <Send size={16} /> {busy === "new" ? "Sending..." : "Send for approval"}
          </button>
        </form>
      ) : null}

      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
      {loading ? <p style={{ color: "#78716c" }}>Loading...</p> : null}

      {owner && !loading && !pending.length ? <div style={{ ...card, color: "#57534e" }}>No manager requests waiting.</div> : null}
      {pending.length ? (
        <div style={{ display: "grid", gap: 10 }}>
          <strong>{owner ? "Waiting for your decision" : "Waiting for approval"}</strong>
          {pending.map((r) => (
            <div key={r.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <strong>{r.name}</strong> <Status s={r.status} />
                  <div style={{ color: "#57534e", fontSize: "0.85rem", marginTop: 4, lineHeight: 1.6 }}>
                    {owner ? <>Restaurant: <b>{r.restaurant_name || r.restaurant_id}</b> · asked by {r.proposer_name || r.proposed_by}<br /></> : null}
                    Login: {r.username}@{r.restaurant_id} · {r.contact_email}
                    {r.phone ? ` · ${r.phone}` : ""}
                    <br />
                    {when(r.created_at)}
                  </div>
                </div>
              </div>
              {owner ? (
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <input style={{ ...input, flex: 1, minWidth: 180 }} placeholder="Note (optional, sent if declined)" value={note[r.id] || ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} />
                  <input style={{ ...input, flex: 1, minWidth: 180 }} placeholder="Password (optional, empty = we make one)" autoComplete="new-password" value={pws[r.id] || ""} onChange={(e) => setPws({ ...pws, [r.id]: e.target.value })} />
                  <button type="button" disabled={busy === r.id} onClick={() => decide(r.id, "approve")} style={{ minHeight: 44, padding: "0 18px", borderRadius: 12, border: 0, background: "#166534", color: "#fff", fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Check size={16} /> Approve
                  </button>
                  <button type="button" disabled={busy === r.id} onClick={() => decide(r.id, "reject")} style={{ minHeight: 44, padding: "0 18px", borderRadius: 12, border: "1px solid #fecaca", background: "#fff", color: "#991b1b", fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <X size={16} /> Decline
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {history.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          <strong>Earlier requests</strong>
          {history.map((r) => (
            <div key={r.id} style={{ ...card, padding: 14 }}>
              <strong>{r.name}</strong> <Status s={r.status} />
              <div style={{ color: "#57534e", fontSize: "0.85rem", marginTop: 4 }}>
                {owner ? `${r.restaurant_name || r.restaurant_id} · ` : ""}
                {r.status === "approved" && r.login_email ? `Login: ${r.login_email} · ` : ""}
                {when(r.created_at)}
                {r.note ? ` · Note: ${r.note}` : ""}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

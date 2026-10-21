"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Mail, MessageCircleQuestion, Phone, Send, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Query = {
  id: string;
  created_at: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string | null;
  restaurant: string | null;
  question: string;
  status: "open" | "answered" | "closed";
  reply: string | null;
  replied_at: string | null;
  reply_seen: number | null;
  inApp: boolean;
};

async function call(path: string, method = "GET", body?: unknown) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

const roleLabel: Record<string, string> = { manager: "Manager", waiter: "Waiter", guest: "Guest" };

const badge = (status: Query["status"]) =>
  status === "open"
    ? { background: "#fff1e8", color: "#b83d00", label: "OPEN" }
    : status === "answered"
    ? { background: "#dcfce7", color: "#166534", label: "ANSWERED" }
    : { background: "#efedea", color: "#57534e", label: "CLOSED" };

export default function Queries({ onChange }: { onChange?: () => void }) {
  const [rows, setRows] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"open" | "answered" | "all">("open");
  const [openId, setOpenId] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await call("/api/admin/queries");
      setRows(d.queries);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load queries");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  async function act(body: Record<string, unknown>, ok: string) {
    setBusy(String(body.id));
    try {
      const d = await call("/api/admin/queries", "POST", body);
      if (body.action === "reply") {
        toast.success(ok);
        if (d.mail?.sent) toast.success("Email sent to them.");
        else toast.warning(`Email was not sent. ${d.mail?.reason || ""}`);
        if (d.pushed) toast.success("Notification sent to their phone.");
        setOpenId("");
        setDraft("");
      } else toast.success(ok);
      await load();
      onChange?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy("");
    }
  }

  const shown = rows.filter((r) => (filter === "all" ? true : filter === "open" ? r.status === "open" : r.status !== "open"));
  const openCount = rows.filter((r) => r.status === "open").length;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <span className="access-badge">
          <MessageCircleQuestion size={16} /> QUESTIONS FROM THE APP
        </span>
        <h2 style={{ marginTop: 8 }}>Queries</h2>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          Questions Mira could not answer. Each row has the contact details the person gave when they registered. Reply here and they get it by email, in the app, and as a phone notification when they are signed in.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {([["open", `Open (${openCount})`], ["answered", "Answered / closed"], ["all", "All"]] as const).map(([k, label]) => (
          <button key={k} className={filter === k ? "primary" : "secondary"} onClick={() => setFilter(k)}>
            {label}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading queries…</p>}
      {!loading && !shown.length && (
        <div className="empty">
          <h3>{filter === "open" ? "No open questions." : "Nothing here yet."}</h3>
          <p className="muted">When someone sends a question from the app it appears here.</p>
        </div>
      )}

      {shown.length > 0 && (
        <div style={{ overflowX: "auto", border: "1px solid #e8e6e2", borderRadius: 14, background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem", minWidth: 980 }}>
            <thead>
              <tr style={{ textAlign: "left", background: "#faf9f7" }}>
                {["Asked", "Name", "Restaurant", "Email", "Phone", "Question", "Status", ""].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", fontWeight: 700, color: "#57534e", borderBottom: "1px solid #e8e6e2", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((q) => {
                const b = badge(q.status);
                const expanded = openId === q.id;
                return (
                  <FragmentRow key={q.id}>
                    <tr style={{ borderBottom: expanded ? "none" : "1px solid #efedea", verticalAlign: "top" }}>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{when(q.created_at)}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <strong>{q.name || "—"}</strong>
                        <div className="muted" style={{ fontSize: "0.78rem" }}>
                          {q.role ? roleLabel[q.role] || q.role : "Not signed in"}
                          {q.inApp ? " · in app" : ""}
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px" }}>{q.restaurant || "—"}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <a href={`mailto:${q.email}`} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                          <Mail size={13} /> {q.email}
                        </a>
                      </td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        {q.phone ? (
                          <a href={`tel:${q.phone}`} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                            <Phone size={13} /> {q.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", minWidth: 260, maxWidth: 340 }}>
                        <div style={{ whiteSpace: "pre-wrap" }}>{q.question}</div>
                        {q.reply && (
                          <div style={{ marginTop: 6, padding: "6px 10px", background: "#f0fdf4", borderRadius: 8, fontSize: "0.82rem" }}>
                            <b>Your reply</b> · {when(q.replied_at)}
                            {q.inApp && <span style={{ marginLeft: 6 }}>{q.reply_seen ? "· seen in app" : "· not opened yet"}</span>}
                            <div style={{ whiteSpace: "pre-wrap" }}>{q.reply}</div>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ background: b.background, color: b.color, borderRadius: 999, padding: "3px 9px", fontSize: "0.72rem", fontWeight: 800 }}>{b.label}</span>
                      </td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="primary"
                            onClick={() => {
                              setOpenId(expanded ? "" : q.id);
                              setDraft("");
                            }}
                          >
                            <Send size={14} /> {q.reply ? "Reply again" : "Reply"}
                          </button>
                          {q.status === "open" && (
                            <button className="secondary" disabled={busy === q.id} onClick={() => act({ action: "close", id: q.id }, "Marked as closed.")} title="Close without replying">
                              <Check size={14} />
                            </button>
                          )}
                          <button
                            className="secondary"
                            disabled={busy === q.id}
                            title="Delete"
                            onClick={() => window.confirm("Delete this question for good?") && act({ action: "delete", id: q.id }, "Deleted.")}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr style={{ borderBottom: "1px solid #efedea", background: "#fffaf6" }}>
                        <td colSpan={8} style={{ padding: "12px 16px" }}>
                          <div style={{ display: "grid", gap: 8, maxWidth: 720 }}>
                            <label style={{ fontWeight: 700 }}>
                              Reply to {q.name || q.email}
                              <textarea
                                rows={4}
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                placeholder="Type your answer. It is emailed to them and shown in the app."
                                style={{ width: "100%", marginTop: 6 }}
                              />
                            </label>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                              <button className="primary" disabled={busy === q.id || draft.trim().length < 2} onClick={() => act({ action: "reply", id: q.id, reply: draft }, "Reply sent.")}>
                                <Send size={15} /> {busy === q.id ? "Sending…" : "Send reply"}
                              </button>
                              <span className="muted" style={{ fontSize: "0.8rem", display: "inline-flex", gap: 4, alignItems: "center" }}>
                                <Mail size={13} /> email
                                {q.inApp && (
                                  <>
                                    {" · "}
                                    <Smartphone size={13} /> app and phone notification
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </FragmentRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

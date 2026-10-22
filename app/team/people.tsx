"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { shortLogin } from "@/lib/login-id";
import { Mail, Phone, RotateCcw, Search, Utensils, Users as UsersIcon, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

type Row = {
  restaurantId: string;
  restaurant: string;
  login: string;
  name: string | null;
  contactEmail: string | null;
  phone: string | null;
  since: string | null;
  trial: { used: boolean; endsAt: string | null; running: boolean };
  plan: { status: "trial" | "active" | "expired" | "none"; plan: string; endsAt: string | null; msLeft: number };
  paidPaise: number;
  usage: { orders: number; dishes: number; waiters: number };
};
type Guest = { email: string; name: string | null; phone: string | null; usedAt: string; active: boolean; expiresAt: string | null };

async function call(path: string, method = "GET", body?: unknown) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const d = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(d.error || "Request failed");
  return d;
}

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—");
const left = (ms: number) => {
  const d = Math.floor(ms / 86400000);
  return d > 0 ? `${d} day${d === 1 ? "" : "s"} left` : "less than a day left";
};
const card = { background: "#fff", border: "1px solid #e7e5e4", borderRadius: 14, padding: 16, display: "grid", gap: 10 } as const;
const pill = (bg: string, fg: string) => ({ background: bg, color: fg, fontSize: "0.7rem", fontWeight: 800, letterSpacing: 0.5, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }) as const;
const ghost = { minHeight: 40, padding: "0 14px", borderRadius: 10, border: "1px solid #d6d3d1", background: "#fff", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 } as const;

type Filter = "all" | "trial" | "paid" | "ended" | "guests";

// One place to see everyone: contact details, who used their free trial or guest week, the plan and how much of it is
// left, and how busy each restaurant is. Trials and guest weeks can be given again from here.
export default function People() {
  const [rows, setRows] = useState<Row[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await call("/api/admin/people");
      setRows(d.restaurants || []);
      setGuests(d.guests || []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load people.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function run(key: string, fn: () => Promise<unknown>, ok: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that change.");
    } finally {
      setBusy("");
    }
  }

  const needle = q.trim().toLowerCase();
  const match = (...parts: (string | null | undefined)[]) => !needle || parts.some((p) => (p || "").toLowerCase().includes(needle));
  const shown = useMemo(
    () =>
      rows.filter((r) => {
        if (!match(r.name, r.restaurant, r.login, r.contactEmail, r.phone)) return false;
        if (filter === "trial") return r.plan.status === "trial";
        if (filter === "paid") return r.plan.status === "active";
        if (filter === "ended") return r.plan.status === "expired";
        if (filter === "guests") return false;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, needle, filter]
  );
  const shownGuests = guests.filter((g) => (filter === "all" || filter === "guests") && match(g.name, g.email, g.phone));
  const counts = { trial: rows.filter((r) => r.plan.status === "trial").length, paid: rows.filter((r) => r.plan.status === "active").length, ended: rows.filter((r) => r.plan.status === "expired").length };

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 980 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: 14, color: "#78716c" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone or restaurant" style={{ width: "100%", minHeight: 44, padding: "0 12px 0 36px", borderRadius: 10, border: "1px solid #d6d3d1", background: "#fff" }} />
        </div>
        <div className="ob-tabs" role="tablist" style={{ flex: "none" }}>
          {([["all", "All"], ["trial", `Free trial (${counts.trial})`], ["paid", `Paid (${counts.paid})`], ["ended", `Ended (${counts.ended})`], ["guests", `Guests (${guests.length})`]] as [Filter, string][]).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
      {loading ? <p style={{ color: "#78716c" }}>Loading…</p> : null}
      {!loading && !shown.length && !shownGuests.length ? <div style={{ ...card, color: "#57534e" }}>Nobody matches.</div> : null}

      {shown.map((r) => {
        const st = r.plan.status;
        const planPill = st === "active" ? pill("#dcfce7", "#166534") : st === "trial" ? pill("#fef3c7", "#92400e") : pill("#fee2e2", "#991b1b");
        return (
          <div key={r.login} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <strong style={{ fontSize: "1.05rem" }}>{r.name || shortLogin(r.login)}</strong>
                <div style={{ color: "#57534e", fontSize: "0.88rem" }}>
                  {r.restaurant} · <span style={{ fontFamily: "monospace" }}>{shortLogin(r.login)}</span>
                </div>
                <div style={{ color: "#57534e", fontSize: "0.85rem", display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
                  {r.contactEmail ? (
                    <a href={`mailto:${r.contactEmail}`} style={{ color: "#9a3412", display: "inline-flex", gap: 5, alignItems: "center" }}>
                      <Mail size={13} /> {r.contactEmail}
                    </a>
                  ) : null}
                  {r.phone ? (
                    <a href={`tel:${r.phone}`} style={{ color: "#9a3412", display: "inline-flex", gap: 5, alignItems: "center" }}>
                      <Phone size={13} /> {r.phone}
                    </a>
                  ) : null}
                  <span>Joined {when(r.since)}</span>
                </div>
              </div>
              <span style={{ ...planPill, alignSelf: "flex-start" }}>{st === "active" ? "PAID PLAN" : st === "trial" ? "FREE TRIAL" : st === "expired" ? "ENDED" : "NO PLAN"}</span>
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
              <div style={{ background: "#fafaf9", borderRadius: 10, padding: 12 }}>
                <small style={{ color: "#78716c", fontWeight: 700 }}>FREE TRIAL</small>
                <div style={{ fontWeight: 700 }}>
                  {r.trial.running ? `Running · ${left(r.plan.msLeft)}` : r.trial.used ? `Used · ended ${when(r.trial.endsAt)}` : "Not used"}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <button
                    type="button"
                    style={ghost}
                    disabled={busy === r.login}
                    onClick={() => run(r.login, () => call("/api/admin/subscriptions", "POST", { action: "start_trial", restaurant: r.restaurantId, days: 14 }), "Free trial given again.", `Give ${r.restaurant} a fresh 14-day free trial?`)}
                  >
                    <RotateCcw size={14} /> {r.trial.used ? "Give trial again" : "Start trial"}
                  </button>
                  {r.trial.running ? (
                    <button type="button" style={{ ...ghost, color: "#991b1b" }} disabled={busy === r.login} onClick={() => run(r.login, () => call("/api/admin/subscriptions", "POST", { action: "expire", restaurant: r.restaurantId }), "Trial ended.", `End the free trial for ${r.restaurant} now? Their access stops.`)}>
                      End trial now
                    </button>
                  ) : null}
                </div>
              </div>
              <div style={{ background: "#fafaf9", borderRadius: 10, padding: 12 }}>
                <small style={{ color: "#78716c", fontWeight: 700 }}>PLAN</small>
                <div style={{ fontWeight: 700 }}>
                  {st === "active" ? `${r.plan.plan || "Paid"} · ends ${when(r.plan.endsAt)}` : st === "trial" ? "On the free trial" : st === "expired" ? "No active plan" : "No plan yet"}
                </div>
                <small style={{ color: "#57534e" }}>
                  {st === "active" ? left(r.plan.msLeft) : ""}
                  {r.paidPaise ? `${st === "active" ? " · " : ""}Paid online ₹${(r.paidPaise / 100).toLocaleString("en-IN")}` : ""}
                </small>
                {st === "active" ? (
                  <div style={{ marginTop: 8 }}>
                    <button type="button" style={{ ...ghost, color: "#991b1b" }} disabled={busy === r.login} onClick={() => run(r.login, () => call("/api/admin/subscriptions", "POST", { action: "expire", restaurant: r.restaurantId }), "Plan ended.", `End the paid plan for ${r.restaurant} now? Their access stops.`)}>
                      End plan now
                    </button>
                  </div>
                ) : null}
              </div>
              <div style={{ background: "#fafaf9", borderRadius: 10, padding: 12 }}>
                <small style={{ color: "#78716c", fontWeight: 700 }}>USED IN THE APP</small>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4, fontWeight: 700 }}>
                  <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
                    <ShoppingBag size={14} /> {r.usage.orders} orders
                  </span>
                  <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
                    <Utensils size={14} /> {r.usage.dishes} dishes
                  </span>
                  <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
                    <UsersIcon size={14} /> {r.usage.waiters} waiters
                  </span>
                </div>
                <small style={{ color: "#78716c" }}>{r.usage.orders === 0 ? "Has not taken an order yet." : "Real orders only, tests excluded."}</small>
              </div>
            </div>
          </div>
        );
      })}

      {shownGuests.length ? <strong style={{ marginTop: 6 }}>Guests (free week)</strong> : null}
      {shownGuests.map((g) => (
        <div key={g.email} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <strong>{g.name || g.email}</strong>
              <div style={{ color: "#57534e", fontSize: "0.85rem", display: "flex", gap: 14, flexWrap: "wrap" }}>
                <a href={`mailto:${g.email}`} style={{ color: "#9a3412" }}>
                  {g.email}
                </a>
                {g.phone ? <a href={`tel:${g.phone}`} style={{ color: "#9a3412" }}>{g.phone}</a> : null}
                <span>Tried it {when(g.usedAt)}</span>
              </div>
            </div>
            <span style={g.active ? pill("#fef3c7", "#92400e") : pill("#efedea", "#57534e")}>{g.active ? `SANDBOX RUNNING · ends ${when(g.expiresAt)}` : "FREE WEEK USED"}</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={ghost} disabled={busy === g.email} onClick={() => run(g.email, () => call("/api/admin/people", "POST", { action: "reset_guest", email: g.email }), "They can try the guest week again.", `Let ${g.email} try the guest week again? Any sandbox they have now is removed.`)}>
              <RotateCcw size={14} /> Allow guest week again
            </button>
            {g.active ? (
              <button type="button" style={{ ...ghost, color: "#991b1b" }} disabled={busy === g.email} onClick={() => run(g.email, () => call("/api/admin/people", "POST", { action: "end_guest", email: g.email }), "Guest sandbox ended.", `End the guest sandbox for ${g.email} now?`)}>
                End sandbox now
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, Inbox, MapPin, Pencil, Plus, Trash2, X, Crown, Building2 } from "lucide-react";
import { toast } from "sonner";

async function call(path: string, method = "GET", body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

/* ───────────── Registration requests ───────────── */

type Req = {
  id: string;
  email: string;
  owner_name: string;
  phone: string;
  restaurant_name: string;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  status: string;
  note: string | null;
  restaurant_id: string | null;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  contact_email: string | null;
  plan_choice: string | null;
};

const planNames: Record<string, string> = { trial: "Free 14-day trial", monthly: "Monthly", half_yearly: "Half-yearly", yearly: "Yearly" };

export function RegistrationRequests({ onChange }: { onChange?: () => void }) {
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [trialDays, setTrialDays] = useState(14);

  const load = useCallback(async () => {
    try {
      const d = await call("/api/admin/requests");
      setRows(d.requests);
      setTrialDays(d.trialDays);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  async function decide(id: string, action: "approve" | "reject") {
    if (action === "reject" && !window.confirm("Reject this request? The owner will be told it was not approved.")) return;
    setBusy(id);
    try {
      const d = await call("/api/admin/requests", "POST", { id, action, note: notes[id] || undefined });
      toast.success(action === "approve" ? `Approved. ${trialDays}-day free trial started.` : "Request rejected.");
      if (d.restaurantId) toast.message(`Restaurant created: /r/${d.restaurantId}`);
      if (d.mail?.sent) toast.success("Email sent to the owner from your Table Secret address.");
      else toast.warning(`Email was not sent. ${d.mail?.reason || ""} Please tell the owner yourself.`);
      await load();
      onChange?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that decision");
    } finally {
      setBusy("");
    }
  }

  const pending = rows.filter((r) => r.status === "pending");
  const done = rows.filter((r) => r.status !== "pending");

  return (
    <div style={{ maxWidth: 900, display: "grid", gap: 18 }}>
      <div>
        <span className="access-badge">
          <Inbox size={16} /> NEW RESTAURANT REQUESTS
        </span>
        <h2 style={{ marginTop: 8 }}>Requests to join</h2>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          Owners register from the app. Approving creates their restaurant and manager account and starts a {trialDays}-day free trial.
        </p>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading requests…</p>}
      {!loading && !pending.length && <div className="empty"><h3>No requests waiting.</h3><p className="muted">New registrations from the app show up here.</p></div>}

      {pending.map((r) => (
        <div key={r.id} className="form-panel" style={{ display: "grid", gap: 10, borderLeft: "4px solid #df4d03" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <strong style={{ fontSize: "1.1rem" }}>{r.restaurant_name}</strong>
              <div className="muted" style={{ fontSize: "0.85rem" }}>Requested {when(r.created_at)}</div>
            </div>
            <span className="tiny-badge">PENDING</span>
          </div>
          <div style={{ display: "grid", gap: 4, fontSize: "0.92rem" }}>
            <span><b>Owner:</b> {r.owner_name} · {r.phone}</span>
            <span><b>Contact email:</b> {r.contact_email || "—"} <small className="muted">(the approval mail goes here)</small></span>
            <span><b>Login ID to create:</b> {r.email}</span>
            <span><b>Plan interest:</b> {planNames[r.plan_choice || "trial"] || "Free 14-day trial"}</span>
            <span><b>Address:</b> {r.address}, {r.city}</span>
            {r.lat !== null && r.lng !== null ? (
              <a href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <MapPin size={15} /> Pinned location ({r.lat.toFixed(5)}, {r.lng.toFixed(5)}) <ExternalLink size={13} />
              </a>
            ) : (
              <span className="muted">No map pin was shared.</span>
            )}
          </div>
          <label>
            Note (optional, kept in the record)
            <input maxLength={300} value={notes[r.id] || ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="primary" disabled={busy === r.id} onClick={() => decide(r.id, "approve")}>
              <Check size={16} /> {busy === r.id ? "Working…" : "Approve and start trial"}
            </button>
            <button className="secondary" disabled={busy === r.id} onClick={() => decide(r.id, "reject")}>
              <X size={16} /> Reject
            </button>
          </div>
        </div>
      ))}

      {done.length > 0 && (
        <>
          <h3>Earlier decisions</h3>
          <div className="form-panel" style={{ display: "grid", gap: 0, padding: 0 }}>
            {done.map((r, i) => (
              <div key={r.id} style={{ padding: "12px 16px", borderTop: i ? "1px solid var(--line)" : "none", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span>
                  <strong>{r.restaurant_name}</strong> · {r.email}
                  <br />
                  <small className="muted">{when(r.decided_at)} by {r.decided_by || "—"}{r.note ? ` · ${r.note}` : ""}</small>
                </span>
                <span className="tiny-badge" style={{ alignSelf: "center", background: r.status === "approved" ? "#dcfce7" : "#fee2e2", color: r.status === "approved" ? "#166534" : "#991b1b" }}>
                  {r.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ───────────── Directory: every restaurant, manager and waiter ───────────── */

type Acc = { id: string; email: string; name: string; role: string; restaurant_id: string | null; status: string; created_at: string };
type Rest = {
  id: string;
  name: string;
  address: string;
  contact_phone: string;
  contact_email: string;
  status: string;
  created_at: string;
  managers: Acc[];
  waiters: Acc[];
};

function AccountRow({ acc, onDone }: { acc: Acc; onDone: () => void }) {
  const [edit, setEdit] = useState(false);
  const [email, setEmail] = useState(acc.email);
  const [name, setName] = useState(acc.name);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await call("/api/admin/directory", "POST", { action: "edit_account", id: acc.id, email, name });
      toast.success("Saved. They will need to sign in again.");
      setEdit(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Permanently delete ${acc.email} from the database? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await call("/api/admin/directory", "POST", { action: "delete_account", id: acc.id });
      toast.success("Account deleted.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 0", borderTop: "1px solid var(--line)" }}>
      {edit ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
          <input style={{ flex: "1 1 140px" }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          <input style={{ flex: "2 1 220px" }} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        </div>
      ) : (
        <span>
          <strong>{acc.name || acc.email}</strong>
          <br />
          <small className="muted">{acc.email} · {acc.status}</small>
        </span>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        {edit ? (
          <>
            <button className="primary" disabled={busy} onClick={save}>Save</button>
            <button className="secondary" onClick={() => { setEdit(false); setEmail(acc.email); setName(acc.name); }}>Cancel</button>
          </>
        ) : (
          <>
            <button className="icon-button" aria-label="Edit" onClick={() => setEdit(true)}><Pencil size={16} /></button>
            <button className="icon-button" aria-label="Delete" disabled={busy} onClick={remove}><Trash2 size={16} /></button>
          </>
        )}
      </div>
    </div>
  );
}

function AddAccount({ restaurant, role, onDone }: { restaurant: string; role: "admin" | "waiter"; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [temp, setTemp] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const d = await call("/api/admin/directory", "POST", { action: "add_account", role, restaurant, email, name });
      setTemp(d.temporary_password);
      setName("");
      setEmail("");
      toast.success("Account created.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <button className="secondary" onClick={() => setOpen(true)}><Plus size={15} /> Add {role === "admin" ? "manager" : "waiter"}</button>;
  return (
    <form onSubmit={add} style={{ display: "grid", gap: 8, padding: "10px 0" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input required style={{ flex: "1 1 140px" }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <input required type="email" style={{ flex: "2 1 220px" }} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
      </div>
      {temp && <p className="success-note">Temporary password (shown once): <strong>{temp}</strong></p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="primary" disabled={busy} type="submit">Create account</button>
        <button className="secondary" type="button" onClick={() => { setOpen(false); setTemp(""); }}>Close</button>
      </div>
    </form>
  );
}

function RestaurantCard({ r, onDone }: { r: Rest; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ name: r.name, address: r.address, contact_phone: r.contact_phone, contact_email: r.contact_email });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await call("/api/admin/directory", "POST", { action: "edit_restaurant", id: r.id, ...form });
      toast.success("Restaurant updated.");
      setEdit(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function removeRestaurant() {
    const typed = window.prompt(`This permanently deletes ${r.name} and ALL its orders, reviews, menu and accounts. Type the restaurant name to confirm:`);
    if (typed === null) return;
    try {
      await call("/api/admin/directory", "POST", { action: "delete_restaurant", id: r.id, confirm: typed });
      toast.success("Restaurant deleted.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  }

  return (
    <div className="form-panel" style={{ display: "grid", gap: 8 }}>
      <button type="button" onClick={() => setOpen(!open)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: 0, padding: 0, textAlign: "left", width: "100%" }}>
        <span>
          <strong style={{ fontSize: "1.05rem" }}>{r.name}</strong>
          <br />
          <small className="muted">{r.managers.length} manager{r.managers.length === 1 ? "" : "s"} · {r.waiters.length} waiter{r.waiters.length === 1 ? "" : "s"} · /r/{r.id}</small>
        </span>
        <span className="muted">{open ? "Hide ▲" : "Open ▼"}</span>
      </button>

      {open && (
        <div style={{ display: "grid", gap: 6 }}>
          {edit ? (
            <div style={{ display: "grid", gap: 8 }}>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Restaurant name" />
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" />
              <input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="Phone" />
              <input value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="Contact email" />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="primary" disabled={busy} onClick={save}>Save details</button>
                <button className="secondary" onClick={() => setEdit(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <span className="muted" style={{ fontSize: "0.9rem" }}>
                {r.address || "No address"} · {r.contact_phone || "No phone"} · {r.contact_email || "No contact email"}
              </span>
              <span style={{ display: "flex", gap: 8 }}>
                <button className="secondary" onClick={() => setEdit(true)}><Pencil size={15} /> Edit details</button>
                <button className="secondary" onClick={removeRestaurant}><Trash2 size={15} /> Delete restaurant</button>
              </span>
            </div>
          )}

          <h4 style={{ marginTop: 10 }}>Managers</h4>
          {r.managers.length === 0 && <small className="muted">No manager yet.</small>}
          {r.managers.map((m) => <AccountRow key={m.id} acc={m} onDone={onDone} />)}
          <AddAccount restaurant={r.id} role="admin" onDone={onDone} />

          <h4 style={{ marginTop: 10 }}>Waiters</h4>
          {r.waiters.length === 0 && <small className="muted">No waiters yet.</small>}
          {r.waiters.map((m) => <AccountRow key={m.id} acc={m} onDone={onDone} />)}
          <AddAccount restaurant={r.id} role="waiter" onDone={onDone} />
        </div>
      )}
    </div>
  );
}

type Guest = { email: string; restaurant_id: string; contact_email: string | null; contact_name: string | null; contact_phone: string | null; created_at: string; expires_at: string };

function GuestList({ guests, onDone }: { guests: Guest[]; onDone: () => void }) {
  if (!guests.length) return null;
  async function remove(g: Guest) {
    if (!window.confirm(`Remove the guest ${g.contact_email || g.restaurant_id}? They are signed out at once and cannot use that guest week again.`)) return;
    try {
      await call("/api/admin/directory", "POST", { action: "delete_guest", restaurant: g.restaurant_id });
      toast.success("Guest removed.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
    }
  }
  return (
    <div className="form-panel" style={{ display: "grid", gap: 0 }}>
      <h3 style={{ marginBottom: 6 }}>Guests exploring the app ({guests.length})</h3>
      {guests.map((g) => (
        <div key={g.restaurant_id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "10px 0", borderTop: "1px solid var(--line)" }}>
          <span>
            <strong>{g.contact_name || "Guest"}</strong> · {g.contact_phone || "no phone"}
            <br />
            <a href={`mailto:${g.contact_email}`}>{g.contact_email || "Unknown email"}</a>
            <br />
            <small className="muted">Started {when(g.created_at)} · ends {when(g.expires_at)}</small>
          </span>
          <button className="icon-button" aria-label="Remove guest" onClick={() => remove(g)}><Trash2 size={16} /></button>
        </div>
      ))}
    </div>
  );
}

export function Directory() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rows, setRows] = useState<Rest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await call("/api/admin/directory");
      setRows(d.restaurants);
      setGuests(d.guests || []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the directory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? rows.filter((r) => `${r.name} ${r.id} ${r.managers.map((m) => m.email + m.name).join(" ")} ${r.waiters.map((m) => m.email + m.name).join(" ")}`.toLowerCase().includes(needle))
    : rows;

  return (
    <div style={{ maxWidth: 900, display: "grid", gap: 14 }}>
      <div>
        <span className="access-badge"><Building2 size={16} /> DIRECTORY</span>
        <h2 style={{ marginTop: 8 }}>Restaurants, managers and waiters</h2>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          Edit any email or name, add accounts, or delete them straight from the database. Changing an email signs that person out.
        </p>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a restaurant, manager or waiter email" aria-label="Search directory" />
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading…</p>}
      {!loading && !shown.length && <div className="empty"><h3>Nothing found.</h3></div>}
      {shown.map((r) => <RestaurantCard key={r.id} r={r} onDone={load} />)}
      <GuestList guests={guests} onDone={load} />
    </div>
  );
}

/* ───────────── Plans and trials ───────────── */

type Sub = {
  id: string;
  name: string;
  status: "trial" | "active" | "expired" | "none";
  plan: string;
  endsAt: string | null;
  msLeft: number;
  requestedPlan: string;
};

type PlanInfo = { key: string; label: string; active: boolean; months: number };

function left(ms: number) {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}

export function Subscriptions() {
  const [rows, setRows] = useState<Sub[]>([]);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await call("/api/admin/subscriptions");
      setRows(d.subscriptions);
      setPlans(d.plans || []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  // What the Activate button will do, so a wrong end date never comes as a surprise.
  const endNote = (r: Sub, p: PlanInfo) => {
    const renewing = r.status === "active" && r.plan === p.key && !!r.endsAt;
    const end = new Date(renewing ? (r.endsAt as string) : Date.now());
    end.setMonth(end.getMonth() + p.months);
    return renewing ? `Same plan, so it extends the current period. New end date: ${when(end.toISOString())}.` : `Starts today and ends on ${when(end.toISOString())}. Any time left on another plan is replaced.`;
  };

  const labelOf = (k: string) => plans.find((p) => p.key === k)?.label || k;

  async function act(body: Record<string, unknown>, ok: string) {
    setBusy(String(body.restaurant));
    try {
      await call("/api/admin/subscriptions", "POST", body);
      toast.success(ok);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusy("");
    }
  }

  return (
    <div style={{ maxWidth: 900, display: "grid", gap: 14 }}>
      <div>
        <span className="access-badge"><Crown size={16} /> PLANS AND TRIALS</span>
        <h2 style={{ marginTop: 8 }}>Subscriptions</h2>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          New restaurants start with a free trial. When a manager asks for a plan, activate it here once you have received the payment.
        </p>
      </div>
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading…</p>}
      {rows.map((r) => (
        <div key={r.id} className="form-panel" style={{ display: "grid", gap: 10, borderLeft: r.requestedPlan ? "4px solid #df4d03" : undefined }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <span>
              <strong style={{ fontSize: "1.05rem" }}>{r.name}</strong>
              <br />
              <small className="muted">
                {r.status === "active" ? `${labelOf(r.plan) || "Active"} · ends ${when(r.endsAt)} (${left(r.msLeft)})` : r.status === "trial" ? `Free trial · ends ${when(r.endsAt)} (${left(r.msLeft)})` : r.status === "expired" ? "Expired. The app is locked until a plan is activated." : "No plan yet"}
              </small>
            </span>
            <span className="tiny-badge" style={{ alignSelf: "flex-start", background: r.status === "active" ? "#dcfce7" : r.status === "trial" ? "#fef3c7" : "#fee2e2", color: r.status === "active" ? "#166534" : r.status === "trial" ? "#92400e" : "#991b1b" }}>
              {r.status.toUpperCase()}
            </span>
          </div>
          {r.requestedPlan && (
            <p className="success-note" style={{ margin: 0 }}>
              <strong>{labelOf(r.requestedPlan)} plan requested.</strong> Activate it after you receive the payment.
            </p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {plans.filter((p) => p.active || p.key === r.requestedPlan).map((p) => (
              <button
                key={p.key}
                className={r.requestedPlan === p.key ? "primary" : "secondary"}
                disabled={busy === r.id}
                onClick={() => window.confirm(`Activate the ${p.label} plan for ${r.name}?\n\n${endNote(r, p)}`) && act({ action: "activate", restaurant: r.id, plan: p.key }, `${p.label} plan activated.`)}
              >
                Activate {p.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input type="number" min={1} max={90} style={{ width: 90 }} value={days[r.id] ?? 14} onChange={(e) => setDays({ ...days, [r.id]: Number(e.target.value) })} aria-label="Trial days" />
            <button className="secondary" disabled={busy === r.id} onClick={() => act({ action: "start_trial", restaurant: r.id, days: days[r.id] ?? 14 }, "Free trial set.")}>
              Set free trial (days from now)
            </button>
            <button className="secondary" disabled={busy === r.id} onClick={() => window.confirm(`End access for ${r.name} now?`) && act({ action: "expire", restaurant: r.id }, "Plan ended.")}>
              End access now
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

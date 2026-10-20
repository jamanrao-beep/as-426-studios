"use client";

import { useEffect, useState } from "react";
import { Smartphone, Megaphone, Wrench, Send, Store, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import type { GlobalControls, RestaurantControls } from "@/lib/app-controls";

type RestaurantRow = { id: string; name: string; controls: RestaurantControls; devices: number };

const managerLabels: Record<keyof RestaurantControls["manager"], string> = {
  menuEditing: "Edit menu and dishes",
  waiterManagement: "Manage waiters",
  sales: "Monthly sales",
  reviews: "Customer reviews",
  dishPerformance: "Dish performance",
  dishInsights: "Dish insights",
  restaurantSettings: "Restaurant details and ordering on/off",
  qrCode: "QR code and customer link",
};

const waiterLabels: Record<keyof RestaurantControls["waiter"], string> = {
  cancelOrders: "Cancel orders",
  orderHistory: "See earlier orders and history",
};

async function call(method: string, body?: unknown) {
  const res = await fetch("/api/app-controls", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function AppControls() {
  const [global, setGlobal] = useState<GlobalControls | null>(null);
  const [rows, setRows] = useState<RestaurantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [open, setOpen] = useState<string>("");

  const [target, setTarget] = useState("");
  const [roles, setRoles] = useState<{ admin: boolean; waiter: boolean }>({ admin: true, waiter: true });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    try {
      const d = await call("GET");
      setGlobal(d.global);
      setRows(d.restaurants);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load app controls");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveGlobal(next: GlobalControls) {
    setGlobal(next);
    setSavingGlobal(true);
    try {
      const d = await call("PUT", { scope: "global", data: next });
      setGlobal(d.global);
      toast.success("App-wide settings saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
      load();
    } finally {
      setSavingGlobal(false);
    }
  }

  async function saveRestaurant(id: string, controls: RestaurantControls) {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, controls } : x)));
    try {
      await call("PUT", { scope: "restaurant", restaurant: id, data: controls });
      toast.success("Saved. The app picks this up within a minute.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
      load();
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const list = (["admin", "waiter"] as const).filter((r) => roles[r]);
    if (!list.length) return toast.error("Choose who should receive it.");
    setSending(true);
    try {
      const d = await call("POST", { restaurant: target || undefined, roles: list, title, body });
      toast.success(d.sent ? `Sent to ${d.sent} phone${d.sent === 1 ? "" : "s"}.` : "No registered phones yet for that audience.");
      setTitle("");
      setBody("");
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <p className="muted">Loading app controls…</p>;
  if (error || !global) return <p className="error" role="alert">{error || "Could not load app controls"}</p>;

  return (
    <div style={{ maxWidth: 900, display: "grid", gap: 20 }}>
      <div>
        <span className="access-badge">
          <Smartphone size={16} /> MOBILE APP CONTROLS
        </span>
        <h2 style={{ marginTop: 8 }}>Table Secret app</h2>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          Control what restaurant managers and waiters can do in the phone app. Changes reach every phone within a minute.
        </p>
      </div>

      <section className="form-panel" style={{ display: "grid", gap: 14 }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Wrench size={18} /> Maintenance mode
        </h3>
        <label className="switch-label">
          <Switch
            checked={global.maintenance.on}
            disabled={savingGlobal}
            onCheckedChange={(v) => saveGlobal({ ...global, maintenance: { ...global.maintenance, on: v } })}
          />
          {global.maintenance.on ? "ON — the app shows the message below and pauses" : "Off — the app works normally"}
        </label>
        <label>
          Message shown to staff
          <input
            maxLength={300}
            value={global.maintenance.message}
            onChange={(e) => setGlobal({ ...global, maintenance: { ...global.maintenance, message: e.target.value } })}
            placeholder="We are upgrading Table Secret. Back in a few minutes."
          />
        </label>
        <label>
          Oldest app version allowed (optional)
          <input
            maxLength={20}
            value={global.minVersion}
            onChange={(e) => setGlobal({ ...global, minVersion: e.target.value })}
            placeholder="e.g. 1.2.0 — older apps are asked to update"
          />
        </label>

        <h3 style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <Megaphone size={18} /> Announcement popup
        </h3>
        <label className="switch-label">
          <Switch
            checked={global.announcement.on}
            disabled={savingGlobal}
            onCheckedChange={(v) => saveGlobal({ ...global, announcement: { ...global.announcement, on: v } })}
          />
          {global.announcement.on ? "ON — staff see this popup once" : "Off"}
        </label>
        <label>
          Title
          <input
            maxLength={80}
            value={global.announcement.title}
            onChange={(e) => setGlobal({ ...global, announcement: { ...global.announcement, title: e.target.value } })}
            placeholder="New in the app"
          />
        </label>
        <label>
          Message
          <textarea
            maxLength={500}
            value={global.announcement.text}
            onChange={(e) => setGlobal({ ...global, announcement: { ...global.announcement, text: e.target.value } })}
            placeholder="Tell your staff what is new or what to do."
          />
        </label>
        <div>
          <button className="primary" disabled={savingGlobal} onClick={() => saveGlobal(global)}>
            {savingGlobal ? "Saving…" : "Save app-wide settings"}
          </button>
        </div>
      </section>

      <section className="form-panel" style={{ display: "grid", gap: 12 }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BellRing size={18} /> Send a notification to phones
        </h3>
        <form onSubmit={send} style={{ display: "grid", gap: 12 }}>
          <label>
            Who gets it
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Every restaurant</option>
              {rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.devices} phone{r.devices === 1 ? "" : "s"})
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label className="switch-label">
              <Switch checked={roles.admin} onCheckedChange={(v) => setRoles({ ...roles, admin: v })} /> Managers
            </label>
            <label className="switch-label">
              <Switch checked={roles.waiter} onCheckedChange={(v) => setRoles({ ...roles, waiter: v })} /> Waiters
            </label>
          </div>
          <label>
            Title
            <input required maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Message
            <textarea required maxLength={200} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <div>
            <button className="primary" disabled={sending} type="submit">
              <Send size={16} /> {sending ? "Sending…" : "Send notification"}
            </button>
          </div>
        </form>
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Store size={18} /> Per-restaurant controls
        </h3>
        {rows.length === 0 && <p className="muted">No restaurants yet.</p>}
        {rows.map((r) => {
          const c = r.controls;
          const isOpen = open === r.id;
          return (
            <div key={r.id} className="form-panel" style={{ display: "grid", gap: 12 }}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? "" : r.id)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: 0, padding: 0, textAlign: "left", width: "100%" }}
              >
                <span>
                  <strong style={{ fontSize: "1.05rem" }}>{r.name}</strong>
                  <br />
                  <small className="muted">
                    {r.devices} phone{r.devices === 1 ? "" : "s"} registered · app {c.appEnabled ? "on" : "off"}
                  </small>
                </span>
                <span className="muted">{isOpen ? "Hide ▲" : "Edit ▼"}</span>
              </button>

              {isOpen && (
                <div style={{ display: "grid", gap: 12 }}>
                  <label className="switch-label">
                    <Switch checked={c.appEnabled} onCheckedChange={(v) => saveRestaurant(r.id, { ...c, appEnabled: v })} />
                    App access for this restaurant
                  </label>
                  <label className="switch-label">
                    <Switch checked={c.pushEnabled} onCheckedChange={(v) => saveRestaurant(r.id, { ...c, pushEnabled: v })} />
                    Push notifications for new orders and table requests
                  </label>

                  <strong style={{ marginTop: 4 }}>Managers can</strong>
                  {(Object.keys(managerLabels) as Array<keyof typeof managerLabels>).map((k) => (
                    <label className="switch-label" key={k}>
                      <Switch
                        checked={c.manager[k]}
                        onCheckedChange={(v) => saveRestaurant(r.id, { ...c, manager: { ...c.manager, [k]: v } })}
                      />
                      {managerLabels[k]}
                    </label>
                  ))}

                  <strong style={{ marginTop: 4 }}>Waiters can</strong>
                  {(Object.keys(waiterLabels) as Array<keyof typeof waiterLabels>).map((k) => (
                    <label className="switch-label" key={k}>
                      <Switch
                        checked={c.waiter[k]}
                        onCheckedChange={(v) => saveRestaurant(r.id, { ...c, waiter: { ...c.waiter, [k]: v } })}
                      />
                      {waiterLabels[k]}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

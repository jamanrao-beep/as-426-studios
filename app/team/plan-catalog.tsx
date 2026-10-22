"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Star, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type Plan = {
  key: string;
  label: string;
  price: number;
  strike: number;
  months: number;
  blurb: string;
  best: boolean;
  active: boolean;
  sort: number;
  inUse: number;
};

type Draft = { key?: string; label: string; price: string; strike: string; months: string; blurb: string; best: boolean; active: boolean; sort: string };

const blank: Draft = { label: "", price: "", strike: "", months: "1", blurb: "", best: false, active: true, sort: "10" };

async function call(path: string, method = "GET", body?: unknown) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export default function PlanCatalog({ onChange }: { onChange?: () => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await call("/api/admin/plans");
      setPlans(d.plans);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k: keyof Draft, v: string | boolean) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      const body = {
        action: draft.key ? "update" : "create",
        ...(draft.key ? { key: draft.key } : {}),
        label: draft.label,
        price: Number(draft.price),
        strike: Number(draft.strike || 0),
        months: Number(draft.months),
        blurb: draft.blurb,
        best: draft.best,
        active: draft.active,
        sort: Number(draft.sort || 50),
      };
      await call("/api/admin/plans", "POST", body);
      toast.success(draft.key ? "Plan updated. Apps and the website show it right away." : "Plan added. It is live in the app and on the apply page.");
      setDraft(null);
      await load();
      onChange?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(p: Plan) {
    try {
      await call("/api/admin/plans", "POST", { action: "update", key: p.key, label: p.label, price: p.price, strike: p.strike, months: p.months, blurb: p.blurb, best: p.best, active: !p.active, sort: p.sort });
      toast.success(p.active ? "Plan switched off. Nobody can pick it now." : "Plan switched on.");
      await load();
      onChange?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    }
  }

  async function remove(p: Plan) {
    if (!window.confirm(`Delete the ${p.label} plan? This cannot be undone.`)) return;
    try {
      await call("/api/admin/plans", "POST", { action: "delete", key: p.key });
      toast.success("Plan deleted.");
      await load();
      onChange?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  }

  const edit = (p: Plan) =>
    setDraft({ key: p.key, label: p.label, price: String(p.price), strike: String(p.strike), months: String(p.months), blurb: p.blurb, best: p.best, active: p.active, sort: String(p.sort) });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <span className="access-badge">
            <Tag size={16} /> PRICE LIST
          </span>
          <h2 style={{ marginTop: 8 }}>Plans and prices</h2>
          <p className="muted" style={{ fontSize: "0.9rem", maxWidth: 560 }}>
            Add a plan or change a price. It updates in the app, on the apply page and in Mira's answers straight away. Restaurants already on a plan keep their dates.
          </p>
        </div>
        <button className="primary" onClick={() => setDraft({ ...blank, sort: String((plans.at(-1)?.sort || 0) + 1) })}>
          <Plus size={16} /> Add a plan
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading plans…</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 12 }}>
        {plans.map((p) => (
          <div key={p.key} className="form-panel" style={{ display: "grid", gap: 6, opacity: p.active ? 1 : 0.6, borderTop: p.best ? "4px solid #df4d03" : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong style={{ fontSize: "1.05rem" }}>{p.label}</strong>
              <span style={{ display: "flex", gap: 6 }}>
                {p.best && (
                  <span className="tiny-badge" style={{ background: "#fff1e8", color: "#b83d00" }}>
                    <Star size={11} /> BEST VALUE
                  </span>
                )}
                {!p.active && <span className="tiny-badge">OFF</span>}
              </span>
            </div>
            <div>
              <span style={{ fontSize: "1.6rem", fontWeight: 800 }}>{inr(p.price)}</span>{" "}
              {p.strike > p.price && <s className="muted">{inr(p.strike)}</s>}
              <div className="muted" style={{ fontSize: "0.82rem" }}>
                for {p.months} {p.months === 1 ? "month" : "months"} · about {inr(Math.round(p.price / p.months))} a month
              </div>
            </div>
            {p.blurb && <small className="muted">{p.blurb}</small>}
            <small className="muted">{p.inUse ? `${p.inUse} restaurant${p.inUse === 1 ? "" : "s"} on or asking for this` : "Not in use yet"}</small>
            <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              <button className="secondary" onClick={() => edit(p)}>
                <Pencil size={14} /> Edit
              </button>
              <button className="secondary" onClick={() => toggle(p)} title={p.active ? "Switch off" : "Switch on"}>
                {p.active ? <EyeOff size={14} /> : <Eye size={14} />} {p.active ? "Switch off" : "Switch on"}
              </button>
              <button className="secondary" onClick={() => remove(p)} title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {draft && (
        <div className="form-panel" style={{ display: "grid", gap: 12, borderLeft: "4px solid #df4d03" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: "1.05rem" }}>{draft.key ? `Edit ${draft.label || "plan"}` : "New plan"}</strong>
            <button className="secondary" onClick={() => setDraft(null)} aria-label="Close">
              <X size={15} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            <label>
              Plan name
              <input value={draft.label} onChange={(e) => set("label", e.target.value)} placeholder="Quarterly" />
            </label>
            <label>
              Price (₹)
              <input type="number" min={0} value={draft.price} onChange={(e) => set("price", e.target.value)} placeholder="8999" />
            </label>
            <label>
              Crossed-out price (₹)
              <input type="number" min={0} value={draft.strike} onChange={(e) => set("strike", e.target.value)} placeholder="Optional, shows the saving" />
            </label>
            <label>
              Lasts (months)
              <input type="number" min={1} max={120} value={draft.months} onChange={(e) => set("months", e.target.value)} />
            </label>
            <label>
              Order on the page
              <input type="number" min={0} max={999} value={draft.sort} onChange={(e) => set("sort", e.target.value)} />
            </label>
          </div>
          <label>
            One-line description
            <input value={draft.blurb} onChange={(e) => set("blurb", e.target.value)} placeholder="3 months, one payment" />
          </label>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={draft.best} onChange={(e) => set("best", e.target.checked)} /> Show the “Best value” badge
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={draft.active} onChange={(e) => set("active", e.target.checked)} /> Available to pick
            </label>
          </div>
          {Number(draft.price) > 0 && Number(draft.months) > 0 && (
            <small className="muted">
              Shown as {inr(Number(draft.price))} for {draft.months} {Number(draft.months) === 1 ? "month" : "months"}, about {inr(Math.round(Number(draft.price) / Number(draft.months)))} a month
              {Number(draft.strike) > Number(draft.price) ? `, saving ${Math.round(((Number(draft.strike) - Number(draft.price)) / Number(draft.strike)) * 100)}%` : ""}.
            </small>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="primary" onClick={save} disabled={busy || !draft.label.trim() || !draft.price}>
              {busy ? "Saving…" : draft.key ? "Save changes" : "Add plan"}
            </button>
            <button className="secondary" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { poll } from "@/lib/poller";
import { Bell, BellOff, Check, MoreHorizontal, MoreVertical, Search, ShoppingBag, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { indiaDate, orderTime } from "@/lib/order-time";
import { money, transitions, type OrderStatus, type StoredOrder } from "@/lib/orders";
import ServiceRequests from "./service-requests";

// The one orders screen, used by managers and waiters on the website. It mirrors the phone app on purpose:
// three tabs with live counts, one big button per order, Accept all, and one-tap cancel reasons.
// If you change the flow here, change src/components/OrdersPanel.tsx in the app too.

type Segment = "new" | "progress" | "done" | "cancelled";
type Summary = { new: number; accepted: number; preparing: number; served: number; cancelled: number };
const statusFor: Record<Segment, string> = { new: "new", progress: "accepted,preparing", done: "served", cancelled: "cancelled" };
const emptyTitle: Record<Segment, string> = { new: "No new orders.", progress: "Nothing in progress.", done: "No delivered orders yet.", cancelled: "No cancelled orders." };
const actionLabel: Record<string, string> = { accepted: "Accept order", preparing: "Start preparing", served: "Confirm delivered" };
const statusLabel: Record<OrderStatus, string> = { new: "New", accepted: "Accepted", preparing: "Preparing", served: "Delivered", cancelled: "Cancelled" };
const QUICK_REASONS = ["Out of stock", "Guest left", "Duplicate order", "Kitchen closed"];

function chime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t = ctx.currentTime;
    for (const [f, at] of [[587.33, 0], [880, 0.15]] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f, t + at);
      g.gain.setValueAtTime(0.16, t + at);
      g.gain.exponentialRampToValueAtTime(0.001, t + at + 0.4);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t + at);
      o.stop(t + at + 0.4);
    }
  } catch {}
}

function shiftDay(day: string, delta: number) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export default function OrdersBoard({
  restaurant,
  canManage = false,
  canCancel = true,
  canHistory = true,
}: {
  restaurant: string;
  canManage?: boolean;
  canCancel?: boolean;
  canHistory?: boolean;
}) {
  const [segment, setSegment] = useState<Segment>("new");
  const [view, setView] = useState("today");
  const [date, setDate] = useState(indiaDate());
  const [search, setSearch] = useState("");
  const [dSearch, setDSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [summary, setSummary] = useState<Summary>({ new: 0, accepted: 0, preparing: 0, served: 0, cancelled: 0 });
  const [live, setLive] = useState(true);
  const [lastAt, setLastAt] = useState("");
  const [sound, setSound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [deliver, setDeliver] = useState<StoredOrder | null>(null);
  const [cancel, setCancel] = useState<StoredOrder | null>(null);
  const [menuOrder, setMenuOrder] = useState<StoredOrder | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const version = useRef(0);
  const seen = useRef<Set<string>>(new Set());
  const first = useRef(true);
  const sig = useRef("");
  const soundRef = useRef(false);
  const ordersRef = useRef<StoredOrder[]>([]);
  ordersRef.current = orders;
  soundRef.current = sound;

  useEffect(() => {
    const t = setTimeout(() => setDSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(
    async (append = false, quiet = false): Promise<boolean> => {
      const v = ++version.current;
      if (!quiet) setLoading(true);
      try {
        const q = new URLSearchParams({ restaurant, view, offset: String(append ? ordersRef.current.length : 0), status: statusFor[segment] });
        if (canManage) q.set("scope", "manage");
        if (view === "history" && date) q.set("date", date);
        if (dSearch.trim()) q.set("search", dSearch.trim());
        const r = await fetch(`/api/orders?${q}`, { cache: "no-store" });
        const d = (await r.json()) as { orders?: StoredOrder[]; hasMore?: boolean; summary?: Summary; error?: string };
        if (v !== version.current) return true;
        if (!r.ok) throw Error(d.error || "Couldn’t load orders");
        const list = d.orders || [];
        const now = JSON.stringify([list.map((o) => [o.id, o.status]), d.summary, d.hasMore]);
        const changed = append || now !== sig.current;
        sig.current = now;
        if (soundRef.current && !first.current && list.some((o) => o.status === "new" && !seen.current.has(o.id))) chime();
        list.forEach((o) => seen.current.add(o.id));
        first.current = false;
        setOrders((prev) => (append ? [...prev, ...list.filter((n) => !prev.some((o) => o.id === n.id))] : list));
        if (d.summary) setSummary(d.summary);
        setHasMore(!!d.hasMore);
        setLive(true);
        setLastAt(new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }));
        setError("");
        return changed;
      } catch (e) {
        if (v === version.current) {
          setLive(false);
          setError(e instanceof Error ? e.message : "Couldn’t load orders");
        }
        return true;
      } finally {
        if (v === version.current) setLoading(false);
      }
    },
    [restaurant, view, date, segment, dSearch, canManage]
  );

  useEffect(() => {
    first.current = true;
    sig.current = "";
    load(false, false);
    const stop = poll(() => load(false, true));
    return () => {
      version.current++;
      stop();
    };
  }, [load]);

  async function patch(order: StoredOrder, status: OrderStatus, why?: string) {
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurant: order.restaurant_id || restaurant, id: order.id, from: order.status, status, reason: status === "cancelled" ? why?.trim() : undefined }),
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw Object.assign(Error(d.error || "Couldn’t update this order"), { status: res.status });
  }

  async function update(order: StoredOrder, status: OrderStatus, why?: string) {
    const before = [...ordersRef.current];
    setOrders((p) => p.map((o) => (o.id === order.id ? { ...o, status, cancellation_reason: status === "cancelled" ? why?.trim() || o.cancellation_reason : o.cancellation_reason } : o)));
    setDeliver(null);
    setCancel(null);
    setReason("");
    setReasonError("");
    setBusy(order.id);
    setError("");
    setNotice("");
    try {
      await patch(order, status, why);
      load(false, true);
    } catch (e: any) {
      setOrders(before);
      if (e?.status === 409) {
        setNotice(e.message || "This order was just updated by someone else.");
        load(false, true);
      } else setError(e?.message || "Couldn’t update this order");
    } finally {
      setBusy(null);
    }
  }

  async function acceptAll() {
    const waiting = ordersRef.current.filter((o) => o.status === "new");
    setBusy("all");
    setError("");
    let done = 0;
    for (const o of waiting) {
      try {
        await patch(o, "accepted");
        done++;
      } catch (e: any) {
        if (e?.status !== 409) {
          setError(e?.message || "Couldn’t accept every order");
          break;
        }
      }
    }
    setBusy(null);
    if (done) setNotice(done === 1 ? "Order accepted." : `${done} orders accepted.`);
    load(false, true);
  }

  function press(o: StoredOrder, next: OrderStatus) {
    if (next === "served") setDeliver(o);
    else update(o, next);
  }

  const chooseView = (k: string) => {
    setOrders([]);
    setView(k);
    setSegment(k === "history" ? "done" : "new");
  };
  const newCount = orders.filter((o) => o.status === "new").length;

  return (
    <section className="ob" aria-label="Orders">
      <ServiceRequests restaurant={restaurant} />

      <div className="ob-toolbar">
        <span className={live ? "ob-live ok" : "ob-live bad"} role="status">
          <i /> {live ? `Live${lastAt ? ` · ${lastAt}` : ""}` : "Offline · retrying"}
        </span>
        <button className="ob-icon" aria-label={searchOpen ? "Close search" : "Search orders"} onClick={() => { setSearchOpen((o) => !o); if (searchOpen) setSearch(""); }}>
          {searchOpen ? <X size={20} /> : <Search size={20} />}
        </button>
        <button className={sound ? "ob-icon active" : "ob-icon"} aria-label={sound ? "Turn off alert sound" : "Turn on alert sound"} onClick={() => { setSound((s) => !s); if (!sound) chime(); }}>
          {sound ? <Bell size={20} /> : <BellOff size={20} />}
        </button>
        <button className="ob-icon" aria-label="More order views" onClick={() => setMore(true)}>
          <MoreHorizontal size={20} />
        </button>
      </div>

      {searchOpen && (
        <input className="ob-search" autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Guest, order number or table" aria-label="Search orders" />
      )}

      <div className="ob-tabs" role="tablist">
        {(
          [
            ["new", "New", summary.new],
            ["progress", "In progress", summary.accepted + summary.preparing],
            ["done", "Done", summary.served],
          ] as const
        ).map(([k, label, n]) => (
          <button key={k} role="tab" aria-selected={segment === k} className={segment === k ? "on" : ""} onClick={() => setSegment(k)}>
            {label} <b>{n}</b>
          </button>
        ))}
      </div>

      {(view !== "today" || segment === "cancelled") && (
        <div className="ob-filters">
          {view !== "today" && (
            <button className="chip selected" onClick={() => chooseView("today")}>
              {view === "history" ? "Order history" : "Earlier unfinished"} <X size={14} />
            </button>
          )}
          {segment === "cancelled" && (
            <button className="chip selected" onClick={() => setSegment("new")}>
              Cancelled orders <X size={14} />
            </button>
          )}
        </div>
      )}

      {view === "history" && (
        <div className="ob-date">
          <button className="secondary" onClick={() => setDate(shiftDay(date, -1))}>Previous</button>
          <input type="date" value={date} max={indiaDate()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Order date" />
          <button className="secondary" disabled={date >= indiaDate()} onClick={() => setDate(shiftDay(date, 1))}>Next</button>
        </div>
      )}

      {!live && orders.length > 0 && <p className="ob-warn" role="alert">Could not fetch the latest orders. Showing the last received.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="ob-notice" role="status">{notice}</p>}

      {segment === "new" && view === "today" && newCount > 1 && (
        <button className="secondary ob-all" disabled={busy !== null} onClick={acceptAll}>
          <Check size={16} /> {busy === "all" ? "Accepting…" : `Accept all ${newCount} new orders`}
        </button>
      )}

      {loading && !orders.length && <p role="status">Loading orders…</p>}
      {!loading && !error && !orders.length && (
        <div className="empty">
          <ShoppingBag size={30} />
          <h2>{emptyTitle[segment]}</h2>
          <p>Orders placed by customers appear here automatically.</p>
        </div>
      )}

      <div className="orders-grid">
        {orders.map((o) => {
          const actions = (transitions[o.status] || []).filter((a) => a !== "cancelled" || canCancel);
          const forward = actions.find((a) => a !== "cancelled");
          const canVoid = actions.includes("cancelled");
          const isTest = (o as any).is_test === 1;
          return (
            <article key={o.id} className={`order-card status-${o.status}`}>
              {isTest && <div className="ob-test">TEST ORDER. DO NOT PREPARE OR CHARGE.</div>}
              <header>
                <div>
                  <h3>Table {o.table_label}</h3>
                  <small>#{o.id.slice(0, 8).toUpperCase()} · {orderTime(o.created_at)} IST</small>
                </div>
                <span className={`ob-badge ${o.status}`}>{statusLabel[o.status] || o.status}</span>
                {canVoid && (
                  <button className="ob-icon" aria-label="Order options" onClick={() => setMenuOrder(o)}>
                    <MoreVertical size={20} />
                  </button>
                )}
              </header>

              <div className="order-items">
                {o.items.map((i) => (
                  <div key={i.id}>
                    <span><strong>{i.quantity}×</strong> {i.name}</span>
                    <span>{money(i.unitPrice * i.quantity)}</span>
                  </div>
                ))}
              </div>

              {o.customer_name && <p className="order-name">Guest: {o.customer_name}</p>}
              {o.notes && <p className="order-notes"><strong>Guest’s note:</strong> {o.notes}</p>}

              <div className="cart-total">
                <strong>Total · pay at restaurant</strong>
                <strong>{money(o.total)}</strong>
              </div>

              {o.completed_at && <p className="muted ob-small">Delivered {orderTime(o.completed_at)} IST{o.completed_by ? ` by ${o.completed_by}` : ""}</p>}
              {o.status === "cancelled" && (
                <div className="ob-cancelled">
                  <strong>Cancelled by {o.cancelled_by_name || o.cancelled_by || "Staff"}{o.cancelled_by_role ? ` (${o.cancelled_by_role})` : ""}</strong>
                  {o.cancellation_reason && <span>Reason: {o.cancellation_reason}</span>}
                  <small>{orderTime(o.cancelled_at || o.updated_at)} IST</small>
                </div>
              )}

              {forward && (
                <button className="primary ob-go" disabled={busy !== null} onClick={() => press(o, forward)}>
                  {busy === o.id ? "Updating…" : actionLabel[forward]}
                </button>
              )}
            </article>
          );
        })}
      </div>

      {hasMore && (
        <button className="secondary" disabled={loading} onClick={() => load(true)}>
          Load older orders
        </button>
      )}

      <Dialog open={more} onOpenChange={setMore}>
        <DialogContent className="editor-modal">
          <DialogTitle>Order views</DialogTitle>
          <DialogDescription>Today starts fresh at midnight India time (IST).</DialogDescription>
          <div className="ob-menu">
            {[
              ["today", "Today’s orders", "Orders since midnight"],
              ...(canHistory ? [["unfinished", "Earlier unfinished", "Older orders nobody finished"], ["history", "Order history", "Look back at any date"]] : []),
            ].map(([k, label, hint]) => (
              <button key={k} className={view === k && segment !== "cancelled" ? "on" : ""} onClick={() => { chooseView(k); setMore(false); }}>
                <span><strong>{label}</strong><small>{hint}</small></span>
                {view === k && segment !== "cancelled" && <Check size={18} />}
              </button>
            ))}
            <button className={segment === "cancelled" ? "on" : ""} onClick={() => { setSegment("cancelled"); setMore(false); }}>
              <span><strong>Cancelled orders</strong><small>Voided tickets with their reasons</small></span>
              {segment === "cancelled" && <Check size={18} />}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!menuOrder} onOpenChange={(v) => !v && setMenuOrder(null)}>
        <DialogContent className="editor-modal">
          <DialogTitle>Order #{menuOrder?.id.slice(0, 8).toUpperCase()}</DialogTitle>
          <DialogDescription>Table {menuOrder?.table_label}</DialogDescription>
          <div className="ob-actions">
            <button className="secondary" onClick={() => setMenuOrder(null)}>Keep order</button>
            <button className="ob-danger" onClick={() => { const o = menuOrder; setMenuOrder(null); if (o) { setCancel(o); setReason(""); setReasonError(""); } }}>
              Cancel this order
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deliver} onOpenChange={(v) => !v && setDeliver(null)}>
        <DialogContent className="editor-modal">
          <DialogTitle>Confirm delivery</DialogTitle>
          <DialogDescription>Have all items been delivered to table {deliver?.table_label}? A delivered order cannot be reopened.</DialogDescription>
          <div className="ob-actions">
            <button className="secondary" onClick={() => setDeliver(null)}>Not yet</button>
            <button className="primary" disabled={busy !== null} onClick={() => deliver && update(deliver, "served")}>Confirm delivered</button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancel} onOpenChange={(v) => !v && setCancel(null)}>
        <DialogContent className="editor-modal">
          <DialogTitle>Cancel order #{cancel?.id.slice(0, 8).toUpperCase()}?</DialogTitle>
          <DialogDescription>Table {cancel?.table_label}. The guest sees this reason on their order screen.</DialogDescription>
          <div className="ob-quick">
            {QUICK_REASONS.map((q) => (
              <button key={q} type="button" className={reason === q ? "chip selected" : "chip"} onClick={() => { setReason(q); setReasonError(""); }}>
                {q}
              </button>
            ))}
          </div>
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Or write your own reason" aria-label="Cancellation reason" />
          {reasonError && <p className="error">{reasonError}</p>}
          <div className="ob-actions">
            <button className="secondary" onClick={() => setCancel(null)}>Keep order</button>
            <button
              className="ob-danger"
              disabled={busy !== null}
              onClick={() => {
                if (reason.trim().length < 2) return setReasonError("A cancellation reason is required. The guest will see it.");
                if (cancel) update(cancel, "cancelled", reason.trim());
              }}
            >
              Cancel order
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

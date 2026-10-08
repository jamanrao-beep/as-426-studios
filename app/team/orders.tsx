"use client";

import { useEffect, useState, useRef } from "react";
import { indiaDate, orderTime } from "@/lib/order-time";
import { RefreshCw, ShoppingBag, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { money, transitions, type StoredOrder, type OrderStatus } from "@/lib/orders";

export default function Orders({
  restaurant,
  canEdit = false,
  isWaiter = false,
}: {
  restaurant?: string;
  canEdit?: boolean;
  isWaiter?: boolean;
}) {
  const requestVersion = useRef(0);
  const [view, setView] = useState("today");
  const [date, setDate] = useState(indiaDate());
  const [deliver, setDeliver] = useState<StoredOrder | null>(null);
  const [rows, setRows] = useState<StoredOrder[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [cancel, setCancel] = useState<StoredOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");

  async function load(append = false, quiet = false) {
    const version = ++requestVersion.current;
    if (!quiet) setLoading(true);
    try {
      const r = await fetch(
        `/api/orders?${restaurant ? `restaurant=${encodeURIComponent(restaurant)}&` : ""}view=${view}&date=${date}&offset=${append ? rows.length : 0}${canEdit ? "&scope=manage" : ""}`
      );
      const d = (await r.json()) as { orders: StoredOrder[]; hasMore: boolean; error?: string };
      if (version !== requestVersion.current) return;
      if (!r.ok) {
        if (r.status === 403) setRows([]);
        throw Error(d.error);
      }
      setRows((old) => (append ? [...old, ...d.orders.filter((n) => !old.some((o) => o.id === n.id))] : d.orders));
      setMore(d.hasMore);
      setError("");
    } catch (e) {
      if (version === requestVersion.current) setError(e instanceof Error ? e.message : "Couldn’t load orders");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(() => load(false, true), 8000);
    return () => {
      requestVersion.current++;
      clearInterval(t);
    };
  }, [restaurant, canEdit, view, date]);

  async function update(order: StoredOrder, status: OrderStatus, reason?: string) {
    setBusy(order.id);
    setError("");
    try {
      const r = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant: order.restaurant_id,
          id: order.id,
          from: order.status,
          status,
          reason: status === "cancelled" ? reason?.trim() : undefined,
        }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw Error(d.error);
      setCancel(null);
      setCancelReason("");
      setCancelError("");
      setDeliver(null);
      await load(false, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t update order");
    } finally {
      setBusy(null);
    }
  }

  const labels: Record<string, string> = {
    accepted: "Accept order",
    preparing: "Start preparing",
    served: "Confirm delivered",
    cancelled: "Cancel order",
  };

  const statusDisplay: Record<OrderStatus, string> = {
    new: "Pending Acceptance",
    accepted: "Accepted",
    preparing: "Preparing",
    served: "Delivered",
    cancelled: "Cancelled",
  };

  return (
    <section className="orders-panel">
      <div className="order-view-controls">
        <div className="category-list">
          {[
            ["today", "Today’s orders"],
            ["unfinished", "Earlier unfinished"],
            ["history", "Order history"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={view === key ? "chip selected" : "chip"}
              onClick={() => {
                setRows([]);
                setView(key);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {view === "history" && (
          <label>
            Order date
            <input
              type="date"
              value={date}
              onChange={(e) => {
                if (e.target.value) {
                  setRows([]);
                  setDate(e.target.value);
                }
              }}
            />
          </label>
        )}
        <p className="muted">Today’s orders start fresh at midnight Asia/Kolkata (IST). Historical orders are retained in history.</p>
      </div>

      <div className="list-heading">
        <div>
          <h2>{canEdit ? "Manage table orders" : "Live table orders & notifications"}</h2>
          <p>
            {canEdit
              ? "Review and accept incoming table requests, mark them preparing, and confirm delivery."
              : "Review live table tickets and confirm delivery once dishes are served to customers."}
          </p>
        </div>
        <button className="secondary" disabled={loading} onClick={() => load()}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {loading && !rows.length && <p role="status">Loading orders…</p>}
      {!loading && !error && !rows.length && (
        <div className="empty">
          <ShoppingBag size={30} />
          <h2>No orders found.</h2>
          <p>Orders placed by customers will appear here automatically.</p>
        </div>
      )}

      <div className="orders-grid">
        {rows.map((o) => {
          // Available actions based on status transitions
          const availableActions: OrderStatus[] = transitions[o.status] || [];
          const isTest = (o as any).is_test === 1;

          return (
            <article key={o.id} className={`order-card status-${o.status}`}>
              {/* Test order prominent label */}
              {isTest && (
                <div style={{ marginBottom: "8px", background: "#fef2f2", border: "1px solid #ef4444", color: "#b91c1c", padding: "4px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 700 }}>
                  TEST ORDER — DO NOT PREPARE OR CHARGE.
                </div>
              )}

              <header>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className="eyebrow">{o.restaurant_name}</span>
                  </div>
                  <h3>Table {o.table_label}</h3>
                  <small>
                    #{o.id.slice(0, 8).toUpperCase()} · {orderTime(o.created_at) + " IST"}
                  </small>
                </div>
                <span className="order-status">{statusDisplay[o.status] || o.status}</span>
              </header>

              <div className="order-items">
                {o.items.map((i) => (
                  <div key={i.id}>
                    <span>
                      <strong>{i.quantity}×</strong> {i.name}
                    </span>
                    <span>{money(i.unitPrice * i.quantity)}</span>
                  </div>
                ))}
              </div>

              {o.customer_name && <p className="order-name">Guest: {o.customer_name}</p>}
              {o.notes && (
                <p className="order-notes">
                  <strong>Guest’s note:</strong> {o.notes}
                </p>
              )}

              <div className="cart-total">
                <strong>Total</strong>
                <strong>{money(o.total)}</strong>
              </div>

              <p className="cart-note muted">Payment collected at restaurant</p>

              {o.completed_at && (
                <p className="muted" style={{ fontSize: "0.8rem", marginTop: "4px" }}>
                  Delivered: {orderTime(o.completed_at)} IST
                  {o.completed_by && <span> by {o.completed_by}</span>}
                </p>
              )}

              {/* Cancellation Details Attribution */}
              {o.status === "cancelled" && (
                <div style={{ marginTop: "10px", padding: "8px 10px", background: "rgba(239, 68, 68, 0.08)", borderLeft: "3px solid #ef4444", borderRadius: "6px" }}>
                  <div style={{ fontWeight: 600, color: "#dc2626", fontSize: "0.85rem" }}>
                    Cancelled by {o.cancelled_by_name || o.cancelled_by || "Staff"}{o.cancelled_by_role ? ` (${o.cancelled_by_role})` : ""}
                  </div>
                  {o.cancellation_reason && (
                    <div style={{ fontSize: "0.82rem", margin: "3px 0", color: "inherit" }}>
                      <strong>Reason:</strong> {o.cancellation_reason}
                    </div>
                  )}
                  <div style={{ fontSize: "0.76rem", color: "#6b7280" }}>
                    Cancelled at: {orderTime(o.cancelled_at || o.updated_at)} IST
                  </div>
                </div>
              )}

              <div className="order-actions">
                {availableActions.map((next) => (
                  <button
                    disabled={busy !== null}
                    className={next === "cancelled" ? "secondary" : "primary"}
                    key={next}
                    onClick={() =>
                      next === "cancelled"
                        ? setCancel(o)
                        : next === "served"
                        ? setDeliver(o)
                        : update(o, next)
                    }
                  >
                    {busy === o.id ? "Updating…" : labels[next]}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      {more && (
        <button className="secondary" disabled={loading} onClick={() => load(true)}>
          Load older orders
        </button>
      )}

      {/* Confirmation Modal for Delivery */}
      <AlertDialog open={!!deliver} onOpenChange={(v) => !v && setDeliver(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm Delivery</AlertDialogTitle>
          <AlertDialogDescription>
            Have all items in this order been delivered to table <strong>{deliver?.table_label}</strong>?
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy !== null}
              onClick={(e) => {
                e.preventDefault();
                if (deliver) update(deliver, "served");
              }}
            >
              Confirm Delivered
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Modal for Cancellation */}
      <AlertDialog open={!!cancel} onOpenChange={(v) => !v && setCancel(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Cancel Order #{cancel?.id.slice(0, 8).toUpperCase()}?</AlertDialogTitle>
          <AlertDialogDescription>
            Table: <strong>{cancel?.table_label}</strong>. Please enter the reason for cancellation.
            This reason will be visible to the customer on their order tracking screen.
          </AlertDialogDescription>
          <div style={{ marginTop: "10px" }}>
            <textarea
              required
              rows={3}
              placeholder="Enter mandatory cancellation reason..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
            />
            {cancelError && <p className="error" style={{ fontSize: "0.85rem", marginTop: "4px" }}>{cancelError}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setCancelReason(""); setCancelError(""); }}>Keep order</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!cancelReason.trim()) {
                  setCancelError("A cancellation reason is required.");
                  return;
                }
                if (cancel) update(cancel, "cancelled", cancelReason.trim());
              }}
              disabled={busy !== null || !cancelReason.trim()}
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

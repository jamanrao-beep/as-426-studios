"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Utensils,
  LogOut,
  UserCheck,
  Key,
  Eye,
  EyeOff,
  RefreshCw,
  Volume2,
  VolumeX,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  ShoppingBag,
  Wifi,
  WifiOff,
  AlertCircle,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { indiaDate, orderTime, formatISTTime } from "@/lib/order-time";
import { money, transitions, type StoredOrder, type OrderStatus } from "@/lib/orders";

function playNewOrderChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.15);
    gain2.gain.setValueAtTime(0.18, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.55);
  } catch {
    // Non-blocking if audio blocked by browser policy
  }
}

export default function WaiterWorkspace({
  email,
  name,
  assignedRestaurant,
  restaurantName,
  isWaiter = true,
}: {
  email: string;
  name?: string;
  assignedRestaurant?: string;
  restaurantName?: string;
  isWaiter?: boolean;
}) {
  const displayName = name || email;
  const displayRestaurant = restaurantName || assignedRestaurant || "Assigned Restaurant";

  // Navigation views: "today", "unfinished", "history"
  const [view, setView] = useState<"today" | "unfinished" | "history">("today");
  const [historyDate, setHistoryDate] = useState<string>(indiaDate());

  // Filter controls
  const [tableFilter, setTableFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Orders data
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [conflictNotice, setConflictNotice] = useState<string>("");

  // Connection & refresh telemetry
  const [connectionStatus, setConnectionStatus] = useState<"live" | "offline">("live");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>("");

  // Summary counts
  const [summary, setSummary] = useState<{
    new: number;
    accepted: number;
    preparing: number;
    served: number;
    cancelled: number;
  }>({ new: 0, accepted: 0, preparing: 0, served: 0, cancelled: 0 });

  // Sound notifications
  const [soundEnabled, setSoundEnabled] = useState(false);
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialFetchRef = useRef(true);

  // Delivery confirmation dialog
  const [deliverOrder, setDeliverOrder] = useState<StoredOrder | null>(null);

  // Cancellation dialog
  const [cancelOrder, setCancelOrder] = useState<StoredOrder | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [cancelError, setCancelError] = useState<string>("");

  // Password change modal
  const [changePassOpen, setChangePassOpen] = useState(false);
  const [currPass, setCurrPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [passBusy, setPassBusy] = useState(false);
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");

  const requestVersionRef = useRef(0);

  // Load sound setting from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("table_secret_waiter_sound");
      if (stored === "true") setSoundEnabled(true);
    } catch {}
  }, []);

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("table_secret_waiter_sound", String(next));
      } catch {}
      if (next) playNewOrderChime();
      return next;
    });
  }

  // Fetch orders from server
  async function fetchOrders(append = false, quiet = false) {
    if (!assignedRestaurant) return;
    const version = ++requestVersionRef.current;
    if (!quiet) {
      if (append) setRefreshing(true);
      else setLoading(true);
    }

    try {
      const params = new URLSearchParams({
        restaurant: assignedRestaurant,
        view,
        offset: String(append ? orders.length : 0),
      });

      if (view === "history" && historyDate) {
        params.set("date", historyDate);
      }
      if (tableFilter.trim()) {
        params.set("table", tableFilter.trim());
      }
      if (statusFilter.trim()) {
        params.set("status", statusFilter.trim());
      }
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = (await res.json()) as {
        orders?: StoredOrder[];
        hasMore?: boolean;
        summary?: typeof summary;
        error?: string;
      };

      if (version !== requestVersionRef.current) return;

      if (!res.ok) {
        setConnectionStatus("offline");
        throw new Error(data.error || "Failed to load orders.");
      }

      const fetched = data.orders || [];

      // Check for incoming new orders to chime
      if (soundEnabled && !isInitialFetchRef.current) {
        let hasFreshNewOrder = false;
        for (const ord of fetched) {
          if (ord.status === "new" && !seenOrderIdsRef.current.has(ord.id)) {
            hasFreshNewOrder = true;
            break;
          }
        }
        if (hasFreshNewOrder) {
          playNewOrderChime();
        }
      }

      // Record seen IDs
      for (const ord of fetched) {
        seenOrderIdsRef.current.add(ord.id);
      }
      isInitialFetchRef.current = false;

      setOrders((prev) => {
        if (append) {
          const map = new Map(prev.map((o) => [o.id, o]));
          for (const item of fetched) map.set(item.id, item);
          return Array.from(map.values());
        }
        return fetched;
      });

      if (data.summary) {
        setSummary(data.summary);
      }
      setHasMore(!!data.hasMore);
      setConnectionStatus("live");
      setLastRefreshedAt(formatISTTime());
      setError("");
    } catch (err: any) {
      if (version === requestVersionRef.current) {
        setConnectionStatus("offline");
        setError(err?.message || "Could not reach server.");
      }
    } finally {
      if (version === requestVersionRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  // Periodic 8-second refresh loop
  useEffect(() => {
    isInitialFetchRef.current = true;
    fetchOrders(false, false);

    const interval = setInterval(() => {
      fetchOrders(false, true);
    }, 8000);

    return () => {
      requestVersionRef.current++;
      clearInterval(interval);
    };
  }, [assignedRestaurant, view, historyDate, tableFilter, statusFilter, searchQuery]);

  // Order status transition handler with optimistic UI updates
  async function handleStatusChange(
    order: StoredOrder,
    targetStatus: OrderStatus,
    reason?: string
  ) {
    if (!assignedRestaurant) return;
    const previousStatus = order.status;
    const previousOrders = [...orders];

    // Optimistically update local order state immediately for zero-lag UI feedback
    setOrders((prev) =>
      prev.map((item) =>
        item.id === order.id
          ? {
              ...item,
              status: targetStatus,
              updated_at: new Date().toISOString(),
              cancellation_reason:
                targetStatus === "cancelled" ? reason?.trim() || item.cancellation_reason : item.cancellation_reason,
            }
          : item
      )
    );

    setDeliverOrder(null);
    setCancelOrder(null);
    setCancelReason("");
    setBusyOrderId(order.id);
    setError("");
    setConflictNotice("");

    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant: assignedRestaurant,
          id: order.id,
          from: previousStatus,
          status: targetStatus,
          reason: targetStatus === "cancelled" ? reason?.trim() : undefined,
        }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok) {
        // Rollback optimistic update
        setOrders(previousOrders);
        if (res.status === 409) {
          // Concurrency conflict
          setConflictNotice(data.error || "Order status changed concurrently.");
          fetchOrders(false, true);
          return;
        }
        throw new Error(data.error || "Failed to update order status.");
      }

      // Sync server data in the background
      fetchOrders(false, true);
    } catch (err: any) {
      setOrders(previousOrders);
      setError(err?.message || "Status change failed.");
    } finally {
      setBusyOrderId(null);
    }
  }

  // Confirm delivery
  function triggerDeliverConfirm(order: StoredOrder) {
    setDeliverOrder(order);
  }

  // Cancel order modal
  function triggerCancelModal(order: StoredOrder) {
    setCancelOrder(order);
    setCancelReason("");
    setCancelError("");
  }

  async function submitCancellation(e: React.FormEvent) {
    e.preventDefault();
    if (!cancelOrder) return;
    if (!cancelReason.trim() || cancelReason.trim().length < 2) {
      setCancelError("A cancellation reason is required and will be displayed to the customer.");
      return;
    }
    setCancelError("");
    await handleStatusChange(cancelOrder, "cancelled", cancelReason.trim());
  }

  // Password change submission
  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!currPass || !newPass || !confirmPass) {
      setPassError("Please fill all password fields.");
      return;
    }
    if (newPass.length < 6) {
      setPassError("New password must be at least 6 characters.");
      return;
    }
    if (newPass !== confirmPass) {
      setPassError("New password and confirmation do not match.");
      return;
    }

    setPassError("");
    setPassBusy(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currPass, newPassword: newPass }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to change password.");

      setPassSuccess("Password updated successfully.");
      setCurrPass("");
      setNewPass("");
      setConfirmPass("");
      setTimeout(() => {
        setPassSuccess("");
        setChangePassOpen(false);
      }, 1500);
    } catch (err: any) {
      setPassError(err?.message || "Failed to change password.");
    } finally {
      setPassBusy(false);
    }
  }

  const statusDisplay: Record<OrderStatus, string> = {
    new: "Placed",
    accepted: "Accepted",
    preparing: "Preparing",
    served: "Delivered",
    cancelled: "Cancelled",
  };

  const statusBadgeClass: Record<OrderStatus, string> = {
    new: "badge-status-new",
    accepted: "badge-status-accepted",
    preparing: "badge-status-preparing",
    served: "badge-status-delivered",
    cancelled: "badge-status-cancelled",
  };

  return (
    <div className="waiter-workspace-container">
      {/* 1. Header */}
      <header className="waiter-topbar">
        <div className="waiter-topbar-left">
          <div className="waiter-brand">
            <span className="waiter-brand-icon">
              <Utensils size={18} />
            </span>
            <div className="waiter-brand-text">
              <span className="waiter-restaurant-title">{displayRestaurant}</span>
              <span className="waiter-brand-subtitle">Table Secret · Staff Workspace</span>
            </div>
          </div>
        </div>

        <div className="waiter-topbar-right">
          <div className="waiter-status-telemetry">
            {connectionStatus === "live" ? (
              <span className="telemetry-pill live" title="Auto-refreshing every 8 seconds">
                <span className="pulse-dot"></span>
                <span>Live</span>
              </span>
            ) : (
              <span className="telemetry-pill offline" title="Reconnecting...">
                <WifiOff size={13} />
                <span>Offline / Retrying</span>
              </span>
            )}
            {lastRefreshedAt && (
              <span className="telemetry-time">
                <Clock size={12} /> {lastRefreshedAt} IST
              </span>
            )}
          </div>

          <div className="waiter-user-info">
            <span className="waiter-user-name">
              <UserCheck size={13} />
              {displayName}
            </span>
            <span className="waiter-user-email">{email}</span>
          </div>

          <div className="waiter-topbar-actions">
            <button
              type="button"
              className="waiter-header-btn"
              onClick={() => {
                setPassError("");
                setPassSuccess("");
                setChangePassOpen(true);
              }}
              title="Change your password"
            >
              <Key size={14} />
              <span>Password</span>
            </button>

            <a
              className="waiter-header-btn signout"
              href="/api/auth/logout?return_to=/login"
              title="Sign out of account"
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="waiter-main-content">
        {/* Connection Warning Banner when update fails */}
        {connectionStatus === "offline" && (
          <div className="waiter-offline-banner" role="alert">
            <AlertTriangle size={18} />
            <div>
              <strong>Connection Warning:</strong> Failed to fetch latest live updates. Displaying last
              received order data (potentially outdated). Automatically attempting to reconnect...
            </div>
          </div>
        )}

        {/* Concurrency Conflict Banner */}
        {conflictNotice && (
          <div className="waiter-conflict-banner" role="alert">
            <AlertCircle size={18} />
            <div>{conflictNotice}</div>
            <button type="button" onClick={() => setConflictNotice("")}>
              Dismiss
            </button>
          </div>
        )}

        {/* General Error Notice */}
        {error && (
          <div className="waiter-error-banner" role="alert">
            <AlertCircle size={18} />
            <div>{error}</div>
            <button type="button" onClick={() => setError("")}>
              Dismiss
            </button>
          </div>
        )}

        {/* 2. Today's Order Summary KPI Bar */}
        <section className="waiter-summary-section" aria-label="Today's order summary">
          <div className="waiter-kpi-grid">
            <div
              className={`kpi-card kpi-new ${summary.new > 0 ? "highlight-new" : ""}`}
              onClick={() => {
                setView("today");
                setStatusFilter("new");
              }}
            >
              <div className="kpi-label">
                {summary.new > 0 && <span className="pulse-indicator" />}
                New Orders
              </div>
              <div className="kpi-value">{summary.new}</div>
              <div className="kpi-caption">Awaiting acceptance</div>
            </div>

            <div
              className="kpi-card kpi-accepted"
              onClick={() => {
                setView("today");
                setStatusFilter("accepted");
              }}
            >
              <div className="kpi-label">Accepted</div>
              <div className="kpi-value">{summary.accepted}</div>
              <div className="kpi-caption">In queue</div>
            </div>

            <div
              className="kpi-card kpi-preparing"
              onClick={() => {
                setView("today");
                setStatusFilter("preparing");
              }}
            >
              <div className="kpi-label">Preparing</div>
              <div className="kpi-value">{summary.preparing}</div>
              <div className="kpi-caption">Kitchen active</div>
            </div>

            <div
              className="kpi-card kpi-delivered"
              onClick={() => {
                setView("today");
                setStatusFilter("served");
              }}
            >
              <div className="kpi-label">Delivered</div>
              <div className="kpi-value">{summary.served}</div>
              <div className="kpi-caption">Table confirmed</div>
            </div>

            <div
              className="kpi-card kpi-cancelled"
              onClick={() => {
                setView("today");
                setStatusFilter("cancelled");
              }}
            >
              <div className="kpi-label">Cancelled</div>
              <div className="kpi-value">{summary.cancelled}</div>
              <div className="kpi-caption">Voided tickets</div>
            </div>
          </div>
        </section>

        {/* 3. Navigation Views & Controls Toolbar */}
        <section className="waiter-toolbar-section">
          <div className="waiter-nav-tabs">
            <button
              type="button"
              className={`nav-tab-btn ${view === "today" ? "active" : ""}`}
              onClick={() => {
                setView("today");
                setStatusFilter("");
              }}
            >
              Today’s orders {view === "today" && `(${orders.length})`}
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${view === "unfinished" ? "active" : ""}`}
              onClick={() => {
                setView("unfinished");
                setStatusFilter("");
              }}
            >
              Earlier unfinished orders
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${view === "history" ? "active" : ""}`}
              onClick={() => {
                setView("history");
                setStatusFilter("");
              }}
            >
              Order history
            </button>
          </div>

          <div className="waiter-controls-row">
            {/* Date picker for history view */}
            {view === "history" && (
              <div className="control-item date-picker-item">
                <label htmlFor="history-date-input">Select Date (IST):</label>
                <input
                  id="history-date-input"
                  type="date"
                  value={historyDate}
                  max={indiaDate()}
                  onChange={(e) => {
                    if (e.target.value) setHistoryDate(e.target.value);
                  }}
                />
              </div>
            )}

            {/* Filter by Table */}
            <div className="control-item">
              <input
                type="text"
                placeholder="Filter by table..."
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                className="control-input"
              />
            </div>

            {/* Filter by Status */}
            <div className="control-item">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="control-select"
              >
                <option value="">All statuses</option>
                <option value="new">Placed / New</option>
                <option value="accepted">Accepted</option>
                <option value="preparing">Preparing</option>
                <option value="served">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Search by Order # or Name */}
            <div className="control-item search-item">
              <div className="search-box-wrapper">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search order # or guest..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            {/* Sound alert toggle */}
            <button
              type="button"
              className={`sound-toggle-btn ${soundEnabled ? "sound-on" : "sound-off"}`}
              onClick={toggleSound}
              title={soundEnabled ? "Disable sound chime" : "Enable sound chime on new orders"}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span>{soundEnabled ? "Sound ON" : "Sound OFF"}</span>
            </button>

            {/* Manual refresh button */}
            <button
              type="button"
              className="manual-refresh-btn"
              disabled={loading || refreshing}
              onClick={() => fetchOrders(false, false)}
              title="Refresh order feed now"
            >
              <RefreshCw size={15} className={loading || refreshing ? "spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </section>

        {/* 4. Orders Grid Display */}
        <section className="waiter-orders-list-section">
          {loading && orders.length === 0 && (
            <div className="waiter-empty-state loading">
              <RefreshCw size={28} className="spin" />
              <p>Fetching table orders from kitchen queue...</p>
            </div>
          )}

          {!loading && orders.length === 0 && (
            <div className="waiter-empty-state">
              <ShoppingBag size={36} />
              <h3>No orders found</h3>
              <p>
                {view === "today"
                  ? "No orders have been received for today yet."
                  : view === "unfinished"
                  ? "All previous orders are completed or cancelled. No open backlogs!"
                  : "No historical orders match the selected filters."}
              </p>
            </div>
          )}

          <div className="waiter-orders-grid">
            {orders.map((o) => {
              const isTest = o.is_test === 1;
              const isBusy = busyOrderId === o.id;

              return (
                <article
                  key={o.id}
                  className={`waiter-order-card status-border-${o.status} ${
                    o.status === "new" ? "card-highlight-new" : ""
                  }`}
                >
                  {/* Test Order Prominent Label */}
                  {isTest && (
                    <div className="waiter-test-order-banner" role="alert">
                      <AlertTriangle size={15} />
                      <strong>TEST ORDER — DO NOT PREPARE OR CHARGE.</strong>
                    </div>
                  )}

                  {/* Order Card Header */}
                  <div className="order-card-header">
                    <div className="header-left">
                      <span className="table-pill">
                        TABLE <strong>{o.table_label}</strong>
                      </span>
                      <span className="order-id-label">#{o.id.slice(0, 8).toUpperCase()}</span>
                    </div>

                    <div className="header-right">
                      <span className={`status-badge ${statusBadgeClass[o.status] || ""}`}>
                        {statusDisplay[o.status] || o.status}
                      </span>
                    </div>
                  </div>

                  {/* Guest and Timestamps */}
                  <div className="order-meta-row">
                    <span className="meta-time">
                      Placed: <strong>{orderTime(o.created_at)} IST</strong>
                    </span>
                    {o.customer_name && (
                      <span className="meta-guest">
                        Guest: <strong>{o.customer_name}</strong>
                      </span>
                    )}
                  </div>

                  {/* Customer Notes */}
                  {o.notes && (
                    <div className="order-guest-notes">
                      <FileText size={13} />
                      <div>
                        <strong>Guest instructions:</strong> {o.notes}
                      </div>
                    </div>
                  )}

                  {/* Ordered Dishes List */}
                  <div className="order-items-container">
                    <div className="items-heading">Dishes Ordered:</div>
                    <ul className="items-list">
                      {o.items.map((item, idx) => (
                        <li key={`${item.id}-${idx}`} className="item-row">
                          <span className="item-qty-name">
                            <strong className="qty-tag">{item.quantity}×</strong> {item.name}
                          </span>
                          <span className="item-line-price">
                            {money(item.quantity * item.unitPrice)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Order Total */}
                  <div className="order-total-row">
                    <span className="total-label">Order Total</span>
                    <span className="total-amount">{money(o.total)}</span>
                  </div>

                  {/* Lifecycle Timestamps */}
                  <div className="order-lifecycle-details">
                    {o.status === "served" && o.completed_at && (
                      <div className="lifecycle-entry delivered">
                        <CheckCircle2 size={13} />
                        <span>
                          Delivered at: {orderTime(o.completed_at)} IST
                          {o.completed_by && <strong> by {o.completed_by}</strong>}
                        </span>
                      </div>
                    )}

                    {o.status !== "served" && o.status !== "cancelled" && (
                      <div className="lifecycle-entry updated">
                        <Clock size={12} />
                        <span>Last updated: {orderTime(o.updated_at)} IST</span>
                      </div>
                    )}

                    {/* Cancellation Details Card */}
                    {o.status === "cancelled" && (
                      <div className="cancellation-attribution-box" role="status">
                        <div className="cancel-header">
                          <XCircle size={14} />
                          <strong>
                            Cancelled by {o.cancelled_by_name || o.cancelled_by || "Staff"}
                            {o.cancelled_by_role ? ` (${o.cancelled_by_role})` : ""}
                          </strong>
                        </div>
                        {o.cancellation_reason && (
                          <div className="cancel-reason">
                            <strong>Reason:</strong> {o.cancellation_reason}
                          </div>
                        )}
                        <div className="cancel-time">
                          Cancelled at: {orderTime(o.cancelled_at || o.updated_at)} IST
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 5. Allowed Action Buttons */}
                  <div className="order-card-actions">
                    {/* Status: new (Placed) */}
                    {o.status === "new" && (
                      <>
                        <button
                          type="button"
                          className="btn-action btn-accept"
                          disabled={isBusy}
                          onClick={() => handleStatusChange(o, "accepted")}
                        >
                          {isBusy ? "Updating..." : "Accept order"}
                        </button>
                        <button
                          type="button"
                          className="btn-action btn-cancel"
                          disabled={isBusy}
                          onClick={() => triggerCancelModal(o)}
                        >
                          Cancel order
                        </button>
                      </>
                    )}

                    {/* Status: accepted */}
                    {o.status === "accepted" && (
                      <>
                        <button
                          type="button"
                          className="btn-action btn-prepare"
                          disabled={isBusy}
                          onClick={() => handleStatusChange(o, "preparing")}
                        >
                          {isBusy ? "Updating..." : "Start preparing"}
                        </button>
                        <button
                          type="button"
                          className="btn-action btn-deliver"
                          disabled={isBusy}
                          onClick={() => triggerDeliverConfirm(o)}
                        >
                          Confirm delivered
                        </button>
                        <button
                          type="button"
                          className="btn-action btn-cancel"
                          disabled={isBusy}
                          onClick={() => triggerCancelModal(o)}
                        >
                          Cancel order
                        </button>
                      </>
                    )}

                    {/* Status: preparing */}
                    {o.status === "preparing" && (
                      <>
                        <button
                          type="button"
                          className="btn-action btn-deliver"
                          disabled={isBusy}
                          onClick={() => triggerDeliverConfirm(o)}
                        >
                          {isBusy ? "Updating..." : "Confirm delivered"}
                        </button>
                        <button
                          type="button"
                          className="btn-action btn-cancel"
                          disabled={isBusy}
                          onClick={() => triggerCancelModal(o)}
                        >
                          Cancel order
                        </button>
                      </>
                    )}

                    {/* Status: served (Delivered) */}
                    {o.status === "served" && (
                      <div className="read-only-pill delivered">
                        <CheckCircle2 size={14} />
                        <span>Order Completed & Delivered</span>
                      </div>
                    )}

                    {/* Status: cancelled */}
                    {o.status === "cancelled" && (
                      <div className="read-only-pill cancelled">
                        <XCircle size={14} />
                        <span>Order Cancelled</span>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* Load older orders button */}
          {hasMore && (
            <div className="waiter-load-more">
              <button
                type="button"
                className="secondary"
                disabled={loading || refreshing}
                onClick={() => fetchOrders(true, false)}
              >
                {refreshing ? "Loading older orders..." : "Load more orders"}
              </button>
            </div>
          )}
        </section>
      </main>

      {/* Delivery Confirmation Dialog */}
      <AlertDialog open={!!deliverOrder} onOpenChange={(open) => !open && setDeliverOrder(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm Order Delivery</AlertDialogTitle>
          <AlertDialogDescription>
            Have all items in this order been delivered to table{" "}
            <strong>{deliverOrder?.table_label}</strong>?
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction
              disabled={busyOrderId !== null}
              onClick={(e) => {
                e.preventDefault();
                if (deliverOrder) handleStatusChange(deliverOrder, "served");
              }}
            >
              {busyOrderId !== null ? "Recording..." : "Yes, Confirm Delivered"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancellation Dialog with Mandatory Reason */}
      <Dialog open={!!cancelOrder} onOpenChange={(open) => !open && setCancelOrder(null)}>
        <DialogContent className="editor-modal">
          <DialogTitle>Cancel Order #{cancelOrder?.id.slice(0, 8).toUpperCase()}</DialogTitle>
          <DialogDescription>
            Table: <strong>{cancelOrder?.table_label}</strong>. Please enter the reason for cancelling
            this order.
          </DialogDescription>

          <form onSubmit={submitCancellation} className="cancel-form">
            <div className="customer-visibility-notice">
              <AlertCircle size={14} />
              <span>
                Note: This cancellation reason will be visible to the customer on their live order
                tracking screen.
              </span>
            </div>

            {cancelError && <p className="error" role="alert">{cancelError}</p>}

            <label htmlFor="cancel-reason-textarea" style={{ marginTop: "10px", display: "block" }}>
              Cancellation Reason (mandatory):
              <textarea
                id="cancel-reason-textarea"
                required
                rows={3}
                placeholder="e.g. Dish unavailable, table vacated, duplicate order..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                disabled={busyOrderId !== null}
                style={{ width: "100%", marginTop: "6px" }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
              <button
                type="button"
                className="secondary"
                disabled={busyOrderId !== null}
                onClick={() => setCancelOrder(null)}
              >
                Keep order
              </button>
              <button
                type="submit"
                className="btn-danger-confirm"
                disabled={busyOrderId !== null || !cancelReason.trim()}
              >
                {busyOrderId !== null ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Self-Service Change Password Modal */}
      <Dialog open={changePassOpen} onOpenChange={setChangePassOpen}>
        <DialogContent className="editor-modal">
          <DialogTitle>Change Your Website Password</DialogTitle>
          <DialogDescription>
            Update your account password. This website password is separate from your personal Gmail
            password.
          </DialogDescription>

          {passError && <p className="error" role="alert">{passError}</p>}
          {passSuccess && <p className="success-note" role="status">{passSuccess}</p>}

          <form onSubmit={handlePasswordChange}>
            <label>
              Current Password
              <input
                type={showPass ? "text" : "password"}
                required
                value={currPass}
                onChange={(e) => setCurrPass(e.target.value)}
                disabled={passBusy}
              />
            </label>

            <label>
              New Password (min 6 characters)
              <input
                type={showPass ? "text" : "password"}
                required
                minLength={6}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                disabled={passBusy}
              />
            </label>

            <label>
              Confirm New Password
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type={showPass ? "text" : "password"}
                  required
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  disabled={passBusy}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowPass(!showPass)}
                  title={showPass ? "Hide" : "Show"}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
              <button
                type="button"
                className="secondary"
                onClick={() => setChangePassOpen(false)}
                disabled={passBusy}
              >
                Cancel
              </button>
              <button type="submit" className="primary" disabled={passBusy}>
                {passBusy ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

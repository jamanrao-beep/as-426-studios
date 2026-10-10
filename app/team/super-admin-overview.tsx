"use client";

import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Store,
  Users,
  ShoppingBag,
  TrendingUp,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/orders";

interface OverviewData {
  restaurants: {
    total: number;
    active: number;
    suspended: number;
  };
  staff: {
    admins: number;
    waiters: number;
    active: number;
    suspended: number;
  };
  today: {
    date: string;
    orderCount: number;
    deliveredSales: number;
    deliveredCount: number;
    cancelledCount: number;
  };
  monthly: {
    month: string;
    orderCount: number;
    deliveredSales: number;
    deliveredCount: number;
  };
  recentAudit: Array<{
    id: number;
    action: string;
    actor_email: string;
    actor_role: string;
    target_type: string;
    target_id: string;
    created_at: string;
  }>;
  disclaimer: string;
}

export default function SuperAdminOverview({
  restaurants,
  onNavigate,
  onAddRestaurant,
}: {
  restaurants: Array<{ id: string; name: string; active?: boolean; count?: number }>;
  onNavigate: (tab: string, restaurantId?: string) => void;
  onAddRestaurant: () => void;
}) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRest, setSelectedRest] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedRest) params.set("restaurant", selectedRest);
      if (selectedDate) params.set("date", selectedDate);
      if (selectedMonth) params.set("month", selectedMonth);

      const res = await fetch(`/api/admin/overview?${params.toString()}`);
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json.error || "Failed to load overview");
      setData(json);
    } catch (err: any) {
      toast.error(err.message || "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedRest, selectedDate, selectedMonth]);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header & Filter Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <span className="access-badge" style={{ background: "#0284c7", color: "#fff", border: "none" }}>
            <ShieldCheck size={16} /> SUPER ADMIN OVERVIEW
          </span>
          <h2 style={{ fontSize: "1.6rem", marginTop: 8, marginBottom: 4 }}>System Overview & Analytics</h2>
          <p className="muted" style={{ fontSize: "0.88rem" }}>
            Real-time operations monitor across all restaurants, staff, and live orders.
          </p>
        </div>

        {/* Filters */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "8px 14px",
            borderRadius: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Filter size={14} className="muted" />
            <select
              value={selectedRest}
              onChange={(e) => setSelectedRest(e.target.value)}
              style={{
                background: "#131a15",
                color: "#e8efe9",
                border: "1px solid #2a382f",
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: "0.82rem",
              }}
            >
              <option value="">All Restaurants</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Calendar size={14} className="muted" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              placeholder="Date (IST)"
              style={{
                background: "#131a15",
                color: "#e8efe9",
                border: "1px solid #2a382f",
                padding: "5px 10px",
                borderRadius: 8,
                fontSize: "0.82rem",
              }}
            />
          </div>

          {(selectedRest || selectedDate || selectedMonth) && (
            <button
              className="secondary"
              onClick={() => {
                setSelectedRest("");
                setSelectedDate("");
                setSelectedMonth("");
              }}
              style={{ padding: "4px 8px", fontSize: "0.78rem" }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Total Restaurants */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(20,28,24,0.9), rgba(16,22,19,0.95))",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            padding: 20,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onClick={() => onNavigate("settings")}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.82rem", color: "#a5b4a9", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Restaurants
            </span>
            <div style={{ background: "rgba(59,130,246,0.15)", padding: 8, borderRadius: 10, color: "#60a5fa" }}>
              <Store size={18} />
            </div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, margin: "10px 0 6px 0", color: "#fff" }}>
            {data?.restaurants.total ?? "--"}
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: "0.8rem", color: "#8da092" }}>
            <span>
              🟢 <strong style={{ color: "#6ee7b7" }}>{data?.restaurants.active ?? 0}</strong> Active
            </span>
            <span>
              ⏸️ <strong style={{ color: "#fca5a5" }}>{data?.restaurants.suspended ?? 0}</strong> Inactive
            </span>
          </div>
        </div>

        {/* Staff Hierarchy */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(20,28,24,0.9), rgba(16,22,19,0.95))",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            padding: 20,
            cursor: "pointer",
          }}
          onClick={() => onNavigate("managers")}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.82rem", color: "#a5b4a9", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Staff Accounts
            </span>
            <div style={{ background: "rgba(16,185,129,0.15)", padding: 8, borderRadius: 10, color: "#34d399" }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, margin: "10px 0 6px 0", color: "#fff" }}>
            {Number(data?.staff.admins || 0) + Number(data?.staff.waiters || 0)}
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: "0.8rem", color: "#8da092" }}>
            <span>
              👔 <strong>{data?.staff.admins ?? 0}</strong> Admins
            </span>
            <span>
              🍽️ <strong>{data?.staff.waiters ?? 0}</strong> Waiters
            </span>
          </div>
        </div>

        {/* Today's Orders */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(20,28,24,0.9), rgba(16,22,19,0.95))",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            padding: 20,
            cursor: "pointer",
          }}
          onClick={() => onNavigate("orders")}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.82rem", color: "#a5b4a9", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Today's Orders
            </span>
            <div style={{ background: "rgba(245,158,11,0.15)", padding: 8, borderRadius: 10, color: "#fbbf24" }}>
              <ShoppingBag size={18} />
            </div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, margin: "10px 0 6px 0", color: "#fff" }}>
            {data?.today.orderCount ?? "--"}
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: "0.8rem", color: "#8da092" }}>
            <span>
              ✅ <strong style={{ color: "#6ee7b7" }}>{data?.today.deliveredCount ?? 0}</strong> Delivered
            </span>
            <span>
              ❌ <strong style={{ color: "#fca5a5" }}>{data?.today.cancelledCount ?? 0}</strong> Cancelled
            </span>
          </div>
        </div>

        {/* Delivered Sales */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(20,28,24,0.9), rgba(16,22,19,0.95))",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            padding: 20,
            cursor: "pointer",
          }}
          onClick={() => onNavigate("sales")}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.82rem", color: "#a5b4a9", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Delivered Sales Value
            </span>
            <div style={{ background: "rgba(168,85,247,0.15)", padding: 8, borderRadius: 10, color: "#c084fc" }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, margin: "10px 0 6px 0", color: "#34d399" }}>
            {money(data?.today.deliveredSales ?? 0)}
          </div>
          <div style={{ fontSize: "0.78rem", color: "#8da092" }}>
            Month Total: {money(data?.monthly.deliveredSales ?? 0)}
          </div>
        </div>
      </div>

      {/* Quick Launch & Onboarding Progress Panel */}
      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14,
          padding: 22,
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: 8 }}>
              <UtensilsCrossed size={18} /> Restaurant Onboarding Checklist & Flow
            </h3>
            <p className="muted" style={{ fontSize: "0.82rem", marginTop: 2 }}>
              Standard 9-step hierarchy workflow for adding, provisioning, and activating partner venues.
            </p>
          </div>
          <button className="primary" onClick={onAddRestaurant} style={{ fontSize: "0.85rem" }}>
            + Onboard New Restaurant
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div style={{ background: "rgba(0,0,0,0.25)", padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: "0.8rem", color: "#38bdf8", fontWeight: 600 }}>STEP 1 - 2</div>
            <strong style={{ fontSize: "0.88rem", display: "block", marginTop: 2 }}>Restaurant & QR Setup</strong>
            <p className="muted" style={{ fontSize: "0.76rem", marginTop: 4 }}>
              Add restaurant, generate stable customer URL and printable QR code immediately.
            </p>
          </div>

          <div style={{ background: "rgba(0,0,0,0.25)", padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: "0.8rem", color: "#fbbf24", fontWeight: 600 }}>STEP 3 - 5</div>
            <strong style={{ fontSize: "0.88rem", display: "block", marginTop: 2 }}>Admin Provisioning</strong>
            <p className="muted" style={{ fontSize: "0.76rem", marginTop: 4 }}>
              Create Admin account with temporary password; Admin logs in and changes password.
            </p>
          </div>

          <div style={{ background: "rgba(0,0,0,0.25)", padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: "0.8rem", color: "#a78bfa", fontWeight: 600 }}>STEP 6 - 7</div>
            <strong style={{ fontSize: "0.88rem", display: "block", marginTop: 2 }}>Menu & Waiters</strong>
            <p className="muted" style={{ fontSize: "0.76rem", marginTop: 4 }}>
              Admin publishes dishes, sets prices, and provisions waiter accounts for their floor.
            </p>
          </div>

          <div style={{ background: "rgba(0,0,0,0.25)", padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: "0.8rem", color: "#4ade80", fontWeight: 600 }}>STEP 8 - 9</div>
            <strong style={{ fontSize: "0.88rem", display: "block", marginTop: 2 }}>Test & Go Live</strong>
            <p className="muted" style={{ fontSize: "0.76rem", marginTop: 4 }}>
              Run isolated test orders (excluded from sales), then activate menu for live guests.
            </p>
          </div>
        </div>
      </div>

      {/* Audit Trail & Legal Disclaimers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14,
            padding: 18,
          }}
        >
          <h4 style={{ fontSize: "0.95rem", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={16} /> Recent Audit Activity
          </h4>

          {loading ? (
            <p className="muted" style={{ fontSize: "0.85rem" }}>Loading audit log...</p>
          ) : !data?.recentAudit || data.recentAudit.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.85rem" }}>No recent audit events recorded.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.recentAudit.map((log) => (
                <div
                  key={log.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: 8,
                    fontSize: "0.82rem",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <span
                      style={{
                        color: "#6ee7b7",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        fontSize: "0.75rem",
                        marginRight: 8,
                      }}
                    >
                      {log.action.replace(/_/g, " ")}
                    </span>
                    <span style={{ color: "#d1d5db" }}>{log.actor_email}</span>
                    <span className="muted" style={{ marginLeft: 6 }}>
                      ({log.target_type}: {log.target_id})
                    </span>
                  </div>
                  <span className="muted" style={{ fontSize: "0.75rem" }}>
                    {new Date(log.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="muted" style={{ fontSize: "0.76rem", marginTop: 14 }}>
            ℹ️ {data?.disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
}

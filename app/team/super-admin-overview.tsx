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
  QrCode,
  KeyRound,
  ChefHat,
  Rocket,
  Plus,
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

function getAuditBadge(action: string) {
  if (action.includes("order")) {
    return {
      label: "Order Status",
      color: "#38bdf8",
      bg: "rgba(56, 189, 248, 0.12)",
      border: "rgba(56, 189, 248, 0.25)",
      icon: ShoppingBag,
    };
  }
  if (action.includes("menu")) {
    return {
      label: "Menu Updated",
      color: "#fbbf24",
      bg: "rgba(251, 191, 36, 0.12)",
      border: "rgba(251, 191, 36, 0.25)",
      icon: UtensilsCrossed,
    };
  }
  if (action.includes("waiter") || action.includes("manager") || action.includes("account") || action.includes("staff")) {
    return {
      label: "Staff Access",
      color: "#c084fc",
      bg: "rgba(168, 85, 247, 0.12)",
      border: "rgba(168, 85, 247, 0.25)",
      icon: Users,
    };
  }
  if (action.includes("restaurant")) {
    return {
      label: "Restaurant",
      color: "#34d399",
      bg: "rgba(52, 211, 153, 0.12)",
      border: "rgba(52, 211, 153, 0.25)",
      icon: Store,
    };
  }
  return {
    label: action.replace(/_/g, " "),
    color: "#94a3b8",
    bg: "rgba(148, 163, 184, 0.12)",
    border: "rgba(148, 163, 184, 0.25)",
    icon: ShieldCheck,
  };
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
          background: "linear-gradient(135deg, rgba(18, 24, 21, 0.75), rgba(12, 17, 14, 0.85))",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 16,
          padding: "24px 26px",
          marginBottom: 24,
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          <div>
            <h3
              style={{
                fontSize: "1.15rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: "#ffffff",
                letterSpacing: "-0.01em",
              }}
            >
              <div
                style={{
                  background: "rgba(52, 211, 153, 0.15)",
                  color: "#34d399",
                  padding: "6px 8px",
                  borderRadius: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <UtensilsCrossed size={18} />
              </div>
              Restaurant Onboarding Flow & Checklist
            </h3>
            <p
              style={{
                fontSize: "0.84rem",
                color: "#94a3b8",
                marginTop: 4,
                lineHeight: 1.45,
              }}
            >
              Standard 9-step hierarchy workflow for adding, provisioning, and activating partner venues.
            </p>
          </div>
          <button
            className="primary"
            onClick={onAddRestaurant}
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              background: "linear-gradient(135deg, #10b981, #059669)",
              border: "1px solid rgba(110, 231, 183, 0.3)",
              boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            <Plus size={16} strokeWidth={2.5} /> Onboard New Restaurant
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 14,
          }}
        >
          {/* STEP 1-2 */}
          <div
            style={{
              background: "linear-gradient(145deg, rgba(56, 189, 248, 0.06), rgba(15, 23, 42, 0.4))",
              padding: "16px 18px",
              borderRadius: 12,
              border: "1px solid rgba(56, 189, 248, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "#38bdf8",
                  background: "rgba(56, 189, 248, 0.12)",
                  padding: "3px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(56, 189, 248, 0.25)",
                }}
              >
                STEP 1 – 2
              </span>
              <div
                style={{
                  color: "#38bdf8",
                  background: "rgba(56, 189, 248, 0.1)",
                  padding: 6,
                  borderRadius: 8,
                }}
              >
                <QrCode size={16} />
              </div>
            </div>
            <strong style={{ fontSize: "0.95rem", color: "#f8fafc", fontWeight: 600 }}>
              Restaurant & QR Setup
            </strong>
            <p style={{ fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.5, margin: 0 }}>
              Add restaurant, generate stable customer URL and printable table QR code immediately.
            </p>
          </div>

          {/* STEP 3-5 */}
          <div
            style={{
              background: "linear-gradient(145deg, rgba(251, 191, 36, 0.06), rgba(28, 22, 10, 0.4))",
              padding: "16px 18px",
              borderRadius: 12,
              border: "1px solid rgba(251, 191, 36, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "#fbbf24",
                  background: "rgba(251, 191, 36, 0.12)",
                  padding: "3px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(251, 191, 36, 0.25)",
                }}
              >
                STEP 3 – 5
              </span>
              <div
                style={{
                  color: "#fbbf24",
                  background: "rgba(251, 191, 36, 0.1)",
                  padding: 6,
                  borderRadius: 8,
                }}
              >
                <KeyRound size={16} />
              </div>
            </div>
            <strong style={{ fontSize: "0.95rem", color: "#f8fafc", fontWeight: 600 }}>
              Admin Provisioning
            </strong>
            <p style={{ fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.5, margin: 0 }}>
              Create Admin account with temporary password; Admin logs in and securely sets credentials.
            </p>
          </div>

          {/* STEP 6-7 */}
          <div
            style={{
              background: "linear-gradient(145deg, rgba(168, 85, 247, 0.06), rgba(25, 15, 35, 0.4))",
              padding: "16px 18px",
              borderRadius: 12,
              border: "1px solid rgba(168, 85, 247, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "#c084fc",
                  background: "rgba(168, 85, 247, 0.12)",
                  padding: "3px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(168, 85, 247, 0.25)",
                }}
              >
                STEP 6 – 7
              </span>
              <div
                style={{
                  color: "#c084fc",
                  background: "rgba(168, 85, 247, 0.1)",
                  padding: 6,
                  borderRadius: 8,
                }}
              >
                <ChefHat size={16} />
              </div>
            </div>
            <strong style={{ fontSize: "0.95rem", color: "#f8fafc", fontWeight: 600 }}>
              Menu & Waiters
            </strong>
            <p style={{ fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.5, margin: 0 }}>
              Admin publishes dishes, sets live prices, and provisions waiter accounts for their floor.
            </p>
          </div>

          {/* STEP 8-9 */}
          <div
            style={{
              background: "linear-gradient(145deg, rgba(52, 211, 153, 0.06), rgba(12, 28, 20, 0.4))",
              padding: "16px 18px",
              borderRadius: 12,
              border: "1px solid rgba(52, 211, 153, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "#34d399",
                  background: "rgba(52, 211, 153, 0.12)",
                  padding: "3px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(52, 211, 153, 0.25)",
                }}
              >
                STEP 8 – 9
              </span>
              <div
                style={{
                  color: "#34d399",
                  background: "rgba(52, 211, 153, 0.1)",
                  padding: 6,
                  borderRadius: 8,
                }}
              >
                <Rocket size={16} />
              </div>
            </div>
            <strong style={{ fontSize: "0.95rem", color: "#f8fafc", fontWeight: 600 }}>
              Test & Go Live
            </strong>
            <p style={{ fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.5, margin: 0 }}>
              Run isolated test orders (excluded from sales), then activate menu for live guests.
            </p>
          </div>
        </div>
      </div>

      {/* Audit Trail & Legal Disclaimers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        <div
          style={{
            background: "linear-gradient(135deg, rgba(20, 26, 23, 0.75), rgba(13, 18, 15, 0.85))",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 16,
            padding: "22px 24px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.35)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <h4
              style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                gap: 10,
                margin: 0,
              }}
            >
              <div
                style={{
                  background: "rgba(52, 211, 153, 0.15)",
                  color: "#34d399",
                  padding: "6px 8px",
                  borderRadius: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Clock size={16} />
              </div>
              Recent Audit Activity
            </h4>
            <span
              style={{
                fontSize: "0.72rem",
                color: "#94a3b8",
                background: "rgba(255, 255, 255, 0.05)",
                padding: "3px 8px",
                borderRadius: 6,
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              Live Security Log
            </span>
          </div>

          {loading ? (
            <p style={{ color: "#94a3b8", fontSize: "0.85rem", padding: "12px 0" }}>Loading audit log...</p>
          ) : !data?.recentAudit || data.recentAudit.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: "0.85rem", padding: "12px 0" }}>No recent audit events recorded.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.recentAudit.map((log) => {
                const badge = getAuditBadge(log.action);
                const BadgeIcon = badge.icon;
                const formattedTime = new Date(log.created_at).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  dateStyle: "short",
                  timeStyle: "medium",
                });
                const shortTarget =
                  log.target_type === "order" && log.target_id.length > 8
                    ? `Order #${log.target_id.slice(0, 8).toUpperCase()}`
                    : `${log.target_type}: ${log.target_id}`;

                return (
                  <div
                    key={log.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.07)",
                      borderRadius: 10,
                      fontSize: "0.85rem",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          color: badge.color,
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          padding: "3px 9px",
                          borderRadius: 6,
                          textTransform: "uppercase",
                        }}
                      >
                        <BadgeIcon size={12} />
                        {badge.label}
                      </span>
                      <strong style={{ color: "#f8fafc", fontWeight: 600 }}>
                        {log.actor_email}
                      </strong>
                      <span
                        style={{
                          color: "#94a3b8",
                          background: "rgba(0, 0, 0, 0.25)",
                          padding: "2px 7px",
                          borderRadius: 5,
                          fontSize: "0.76rem",
                          border: "1px solid rgba(255, 255, 255, 0.04)",
                          fontFamily: "monospace",
                        }}
                      >
                        {shortTarget}
                      </span>
                    </div>
                    <span
                      style={{
                        color: "#94a3b8",
                        fontSize: "0.76rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Clock size={12} style={{ color: "#64748b" }} />
                      {formattedTime}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <p style={{ color: "#64748b", fontSize: "0.78rem", marginTop: 16, lineHeight: 1.5 }}>
            ℹ️ {data?.disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
}

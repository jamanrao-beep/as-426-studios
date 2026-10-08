"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  Star,
  Award,
  AlertCircle,
  Calendar,
  Filter,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Clock,
  Store,
  ChevronRight,
  Flame,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { orderTime } from "@/lib/order-time";

interface DishItem {
  id: string;
  name: string;
  category: string;
  currentlyAvailable: boolean;
  onCurrentMenu: boolean;
  quantitySold: number;
  ordersCount: number;
  salesValue: number;
  periodRatingsCount: number;
  periodAvgRating: number | null;
  allTimeRatingsCount: number;
  allTimeAvgRating: number;
  latestComments: Array<{ rating: number; comment: string; date: string }>;
  lastSoldAt: string | null;
}

interface PerformanceData {
  restaurant: string;
  restaurantName: string;
  period: string;
  range: { start: string; end: string; label: string };
  dishes: DishItem[];
  summary: {
    totalDeliveredOrders: number;
    totalQuantitySold: number;
    totalSalesValue: number;
    bestSeller: { winners: DishItem[]; isTie: boolean } | null;
    highestValue: { winners: DishItem[]; isTie: boolean } | null;
    highestRated: { winners: DishItem[]; isTie: boolean } | null;
    unsold: {
      total: number;
      availableWithNoSales: DishItem[];
      unavailable: DishItem[];
      note: string;
    };
  };
  disclaimer: string;
}

export default function DishPerformance({
  restaurant,
  restaurants = [],
  isSuperAdmin = false,
  onSelectRestaurant,
}: {
  restaurant: string;
  restaurants?: Array<{ id: string; name: string }>;
  isSuperAdmin?: boolean;
  onSelectRestaurant?: (id: string) => void;
}) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>("today"); // today | yesterday | this_month | last_month | custom
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedDishFeedback, setSelectedDishFeedback] = useState<DishItem | null>(null);

  async function loadReport() {
    if (!restaurant) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        restaurant,
        period,
      });
      if (period === "custom") {
        if (!startDate || !endDate) {
          setLoading(false);
          return;
        }
        params.set("start_date", startDate);
        params.set("end_date", endDate);
      }

      const res = await fetch(`/api/dish-performance?${params.toString()}`);
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json.error || "Failed to load dish performance");
      setData(json);
    } catch (err: any) {
      toast.error(err.message || "Failed to load performance report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
  }, [restaurant, period, startDate, endDate]);

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header and Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <span className="access-badge" style={{ background: "#fef3c7", color: "#92400e" }}>
            <TrendingUp size={16} /> DISH PERFORMANCE & CUSTOMER RATINGS
          </span>
          <h2 style={{ fontSize: "1.5rem", marginTop: 8, marginBottom: 4 }}>
            Menu Dish Analytics: {data?.restaurantName || restaurant}
          </h2>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Track sales volume, revenue contribution, and private dish feedback from delivered table orders.
          </p>
        </div>

        {/* Restaurant selector for Super Admin */}
        {isSuperAdmin && restaurants.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Store size={16} className="muted" />
            <select
              value={restaurant}
              onChange={(e) => onSelectRestaurant && onSelectRestaurant(e.target.value)}
              style={{
                background: "#1c2621",
                color: "#e8efe9",
                border: "1px solid #2e3c33",
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: "0.85rem",
              }}
            >
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Date Period Filter Tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          padding: 8,
          borderRadius: 12,
          marginBottom: 24,
        }}
      >
        <span style={{ fontSize: "0.8rem", color: "#8da092", marginLeft: 6, marginRight: 4 }}>
          Period (IST):
        </span>
        {[
          { key: "today", label: "Today" },
          { key: "yesterday", label: "Yesterday" },
          { key: "this_month", label: "This Month" },
          { key: "last_month", label: "Last Month" },
          { key: "custom", label: "Custom Range" },
        ].map((p) => (
          <button
            key={p.key}
            type="button"
            className={period === p.key ? "primary" : "secondary"}
            onClick={() => setPeriod(p.key)}
            style={{ fontSize: "0.8rem", padding: "6px 12px", minHeight: 32 }}
          >
            {p.label}
          </button>
        ))}

        {period === "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                background: "#131a15",
                color: "#e8efe9",
                border: "1px solid #2a382f",
                padding: "4px 8px",
                borderRadius: 6,
                fontSize: "0.8rem",
              }}
            />
            <span style={{ color: "#8da092" }}>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                background: "#131a15",
                color: "#e8efe9",
                border: "1px solid #2a382f",
                padding: "4px 8px",
                borderRadius: 6,
                fontSize: "0.8rem",
              }}
            />
          </div>
        )}
      </div>

      {/* Period Notice Banner */}
      {data?.range && (
        <div
          style={{
            fontSize: "0.82rem",
            color: "#a5b4a9",
            marginBottom: 18,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Calendar size={14} /> Showing delivered sales & submitted ratings for:{" "}
          <strong style={{ color: "#fff" }}>{data.range.label}</strong>
        </div>
      )}

      {/* 4 Summary Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Best-Selling Dish */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(20,28,24,0.9), rgba(16,22,19,0.95))",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "#a5b4a9", textTransform: "uppercase", letterSpacing: 0.5 }}>
              🏆 Best-Selling Dish
            </span>
            <span className="dish-badge-bestseller">TOP VOLUME</span>
          </div>

          {data?.summary.bestSeller ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff" }}>
                {data.summary.bestSeller.winners.map((w) => w.name).join(" / ")}
              </div>
              <div style={{ marginTop: 4, fontSize: "0.85rem", color: "#6ee7b7" }}>
                <strong>{data.summary.bestSeller.winners[0]?.quantitySold}</strong> portions sold
                {data.summary.bestSeller.isTie && (
                  <span style={{ color: "#fbbf24", marginLeft: 6 }}>(Tied)</span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 14, color: "#8da092", fontSize: "0.85rem" }}>
              No delivered sales recorded in this period.
            </div>
          )}
        </div>

        {/* Highest-Sales-Value Dish */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(20,28,24,0.9), rgba(16,22,19,0.95))",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "#a5b4a9", textTransform: "uppercase", letterSpacing: 0.5 }}>
              💰 Highest Revenue Dish
            </span>
            <span style={{ fontSize: "0.72rem", color: "#34d399", fontWeight: 600 }}>VALUE</span>
          </div>

          {data?.summary.highestValue ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff" }}>
                {data.summary.highestValue.winners.map((w) => w.name).join(" / ")}
              </div>
              <div style={{ marginTop: 4, fontSize: "0.85rem", color: "#34d399" }}>
                ₹{data.summary.highestValue.winners[0]?.salesValue.toLocaleString("en-IN")} sales order value
                {data.summary.highestValue.isTie && (
                  <span style={{ color: "#fbbf24", marginLeft: 6 }}>(Tied)</span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 14, color: "#8da092", fontSize: "0.85rem" }}>
              No sales recorded in this period.
            </div>
          )}
        </div>

        {/* Highest-Rated Dish */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(20,28,24,0.9), rgba(16,22,19,0.95))",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "#a5b4a9", textTransform: "uppercase", letterSpacing: 0.5 }}>
              ⭐ Highest-Rated Dish
            </span>
            <span className="dish-badge-toprated">≥ 5 RATINGS</span>
          </div>

          {data?.summary.highestRated ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff" }}>
                {data.summary.highestRated.winners.map((w) => w.name).join(" / ")}
              </div>
              <div style={{ marginTop: 4, fontSize: "0.85rem", color: "#fcd34d" }}>
                ★ {data.summary.highestRated.winners[0]?.periodAvgRating?.toFixed(1)} (from{" "}
                {data.summary.highestRated.winners[0]?.periodRatingsCount} ratings in period)
                {data.summary.highestRated.isTie && (
                  <span style={{ color: "#fbbf24", marginLeft: 6 }}>(Tied)</span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 14, color: "#8da092", fontSize: "0.82rem" }}>
              Honest threshold: Requires at least 5 ratings in this period.
            </div>
          )}
        </div>

        {/* Unsold Dishes */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(20,28,24,0.9), rgba(16,22,19,0.95))",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "#a5b4a9", textTransform: "uppercase", letterSpacing: 0.5 }}>
              💤 Unsold Dishes
            </span>
            <span style={{ fontSize: "0.72rem", color: "#fca5a5" }}>0 SOLD</span>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff" }}>
              {data?.summary.unsold.total ?? 0}
            </div>
            <div style={{ marginTop: 4, fontSize: "0.78rem", color: "#8da092" }}>
              <span>
                🟢 <strong style={{ color: "#6ee7b7" }}>{data?.summary.unsold.availableWithNoSales.length ?? 0}</strong> Available with 0 sales
              </span>
              <br />
              <span>
                ⏸️ <strong style={{ color: "#fca5a5" }}>{data?.summary.unsold.unavailable.length ?? 0}</strong> Marked sold out
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Dishes Performance Table */}
      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ fontSize: "1.05rem" }}>
            Dish Performance Ranking ({data?.dishes.length ?? 0} items)
          </h3>
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            Delivered orders only · Test orders excluded
          </span>
        </div>

        {loading ? (
          <p className="muted">Loading dish performance report...</p>
        ) : !data?.dishes.length ? (
          <p className="muted">No dish performance data found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left", color: "#8da092" }}>
                  <th style={{ padding: "10px 8px" }}>Dish Name</th>
                  <th style={{ padding: "10px 8px" }}>Category</th>
                  <th style={{ padding: "10px 8px" }}>Status</th>
                  <th style={{ padding: "10px 8px", textAlign: "right" }}>Qty Sold</th>
                  <th style={{ padding: "10px 8px", textAlign: "right" }}>Orders</th>
                  <th style={{ padding: "10px 8px", textAlign: "right" }}>Order Value (₹)</th>
                  <th style={{ padding: "10px 8px" }}>Period Rating</th>
                  <th style={{ padding: "10px 8px" }}>Last Sold (IST)</th>
                  <th style={{ padding: "10px 8px" }}>Feedback</th>
                </tr>
              </thead>
              <tbody>
                {data.dishes.map((dish) => {
                  const isTopSeller = data.summary.bestSeller?.winners.some((w) => w.id === dish.id);
                  const isTopRated = data.summary.highestRated?.winners.some((w) => w.id === dish.id);

                  return (
                    <tr
                      key={dish.id}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        background: isTopSeller ? "rgba(59,130,246,0.03)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "12px 8px" }}>
                        <strong style={{ color: "#fff" }}>{dish.name}</strong>
                        {isTopSeller && <span className="dish-badge-bestseller">Best Seller</span>}
                        {isTopRated && <span className="dish-badge-toprated">Top Rated</span>}
                        {!dish.onCurrentMenu && (
                          <span style={{ fontSize: "0.65rem", color: "#9ca3af", marginLeft: 6 }}>
                            (Unlisted)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 8px", color: "#a5b4a9" }}>{dish.category}</td>
                      <td style={{ padding: "12px 8px" }}>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: dish.currentlyAvailable
                              ? "rgba(16,185,129,0.15)"
                              : "rgba(239,68,68,0.15)",
                            color: dish.currentlyAvailable ? "#6ee7b7" : "#fca5a5",
                          }}
                        >
                          {dish.currentlyAvailable ? "Available" : "Sold out"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: 600 }}>
                        {dish.quantitySold}
                      </td>
                      <td style={{ padding: "12px 8px", textAlign: "right", color: "#a5b4a9" }}>
                        {dish.ordersCount}
                      </td>
                      <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: 600, color: "#34d399" }}>
                        ₹{dish.salesValue.toLocaleString("en-IN")}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        {dish.periodAvgRating !== null ? (
                          <span style={{ color: "#fcd34d", fontWeight: 600 }}>
                            ★ {dish.periodAvgRating.toFixed(1)}{" "}
                            <small className="muted">({dish.periodRatingsCount})</small>
                          </span>
                        ) : dish.allTimeRatingsCount > 0 ? (
                          <span className="muted" style={{ fontSize: "0.78rem" }}>
                            ★ {dish.allTimeAvgRating.toFixed(1)} <small>(all-time)</small>
                          </span>
                        ) : (
                          <span className="muted" style={{ fontSize: "0.78rem" }}>
                            Not rated yet
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 8px", color: "#8da092", fontSize: "0.78rem" }}>
                        {dish.lastSoldAt ? orderTime(dish.lastSoldAt) : "—"}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        {dish.latestComments.length > 0 ? (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => setSelectedDishFeedback(dish)}
                            style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                          >
                            <MessageSquare size={12} style={{ marginRight: 4 }} />
                            {dish.latestComments.length} comment{dish.latestComments.length > 1 ? "s" : ""}
                          </button>
                        ) : (
                          <span className="muted" style={{ fontSize: "0.78rem" }}>
                            None
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Unsold Dishes Limitation Note */}
        <div style={{ marginTop: 18, fontSize: "0.76rem", color: "#8da092" }}>
          ℹ️ {data?.summary.unsold.note}
        </div>
      </div>

      {/* Legal & Accounting Disclaimer */}
      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10,
          padding: 14,
          fontSize: "0.78rem",
          color: "#8da092",
        }}
      >
        ⚖️ {data?.disclaimer}
      </div>

      {/* Private Customer Feedback Dialog */}
      <Dialog open={!!selectedDishFeedback} onOpenChange={(v) => !v && setSelectedDishFeedback(null)}>
        <DialogContent className="editor-modal" style={{ maxWidth: 520 }}>
          <DialogTitle>Private Feedback for {selectedDishFeedback?.name}</DialogTitle>
          <DialogDescription>
            Confidential guest ratings and comments submitted for delivered orders.
          </DialogDescription>

          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {selectedDishFeedback?.latestComments.map((c, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  padding: "10px 14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#fcd34d", fontWeight: 600, fontSize: "0.85rem" }}>
                    ★ {c.rating} / 5
                  </span>
                  <span className="muted" style={{ fontSize: "0.72rem" }}>
                    {orderTime(c.date)} IST
                  </span>
                </div>
                <p style={{ marginTop: 6, fontSize: "0.85rem", color: "#e2e8f0" }}>
                  "{c.comment}"
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

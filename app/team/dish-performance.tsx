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
import { money } from "@/lib/orders";

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
                background: "#fff",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: "0.85rem",
                fontWeight: 600,
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
          background: "#fff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          padding: 8,
          borderRadius: 12,
          marginBottom: 24,
        }}
      >
        <span style={{ fontSize: "0.82rem", color: "#1e293b", fontWeight: 700, marginLeft: 6, marginRight: 4 }}>
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
                background: "#fff",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                padding: "4px 8px",
                borderRadius: 6,
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
            />
            <span style={{ color: "#475569", fontWeight: 600 }}>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                background: "#fff",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                padding: "4px 8px",
                borderRadius: 6,
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
            />
          </div>
        )}
      </div>

      {/* Period Notice Banner */}
      {data?.range && (
        <div
          style={{
            fontSize: "0.84rem",
            color: "#334155",
            marginBottom: 18,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontWeight: 500,
          }}
        >
          <Calendar size={15} style={{ color: "#047857" }} /> Showing delivered sales & submitted ratings for:{" "}
          <strong style={{ color: "#0f172a", fontWeight: 700 }}>{data.range.label}</strong>
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
            background: "#fff",
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>
              🏆 Best-Selling Dish
            </span>
            <span className="dish-badge-bestseller">TOP VOLUME</span>
          </div>

          {data?.summary.bestSeller ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a" }}>
                {data.summary.bestSeller.winners.map((w) => w.name).join(" / ")}
              </div>
              <div style={{ marginTop: 4, fontSize: "0.85rem", color: "#047857" }}>
                <strong>{data.summary.bestSeller.winners[0]?.quantitySold}</strong> portions sold
                {data.summary.bestSeller.isTie && (
                  <span style={{ color: "#d97706", marginLeft: 6 }}>(Tied)</span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 14, color: "#64748b", fontSize: "0.85rem" }}>
              No delivered sales recorded in this period.
            </div>
          )}
        </div>

        {/* Highest-Sales-Value Dish */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>
              💰 Highest Revenue Dish
            </span>
            <span style={{ fontSize: "0.72rem", color: "#047857", fontWeight: 700, background: "#ecfdf5", padding: "2px 6px", borderRadius: 4 }}>VALUE</span>
          </div>

          {data?.summary.highestValue ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a" }}>
                {data.summary.highestValue.winners.map((w) => w.name).join(" / ")}
              </div>
              <div style={{ marginTop: 4, fontSize: "0.85rem", color: "#047857", fontWeight: 700 }}>
                {money(data.summary.highestValue.winners[0]?.salesValue || 0)} sales order value
                {data.summary.highestValue.isTie && (
                  <span style={{ color: "#d97706", marginLeft: 6 }}>(Tied)</span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 14, color: "#64748b", fontSize: "0.85rem" }}>
              No sales recorded in this period.
            </div>
          )}
        </div>

        {/* Highest-Rated Dish */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>
              ⭐ Highest-Rated Dish
            </span>
            <span className="dish-badge-toprated">≥ 5 RATINGS</span>
          </div>

          {data?.summary.highestRated ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a" }}>
                {data.summary.highestRated.winners.map((w) => w.name).join(" / ")}
              </div>
              <div style={{ marginTop: 4, fontSize: "0.85rem", color: "#b45309", fontWeight: 700 }}>
                ★ {data.summary.highestRated.winners[0]?.periodAvgRating?.toFixed(1)} (from{" "}
                {data.summary.highestRated.winners[0]?.periodRatingsCount} ratings in period)
                {data.summary.highestRated.isTie && (
                  <span style={{ color: "#d97706", marginLeft: 6 }}>(Tied)</span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 14, color: "#64748b", fontSize: "0.82rem" }}>
              Honest threshold: Requires at least 5 ratings in this period.
            </div>
          )}
        </div>

        {/* Unsold Dishes */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>
              💤 Unsold Dishes
            </span>
            <span style={{ fontSize: "0.72rem", color: "#dc2626", fontWeight: 700, background: "#fef2f2", padding: "2px 6px", borderRadius: 4 }}>0 SOLD</span>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>
              {data?.summary.unsold.total ?? 0}
            </div>
            <div style={{ marginTop: 4, fontSize: "0.78rem", color: "#475569" }}>
              <span>
                🟢 <strong style={{ color: "#047857" }}>{data?.summary.unsold.availableWithNoSales.length ?? 0}</strong> Available with 0 sales
              </span>
              <br />
              <span>
                ⏸️ <strong style={{ color: "#dc2626" }}>{data?.summary.unsold.unavailable.length ?? 0}</strong> Marked sold out
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Dishes Performance Table */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          borderRadius: 14,
          padding: 20,
          marginBottom: 24,
          color: "#0f172a",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ fontSize: "1.05rem", color: "#0f172a", fontWeight: 700 }}>
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
                <tr style={{ borderBottom: "2px solid #cbd5e1", textAlign: "left", color: "#0f172a" }}>
                  <th style={{ padding: "12px 10px", color: "#0f172a", fontWeight: 700 }}>Dish Name</th>
                  <th style={{ padding: "12px 10px", color: "#0f172a", fontWeight: 700 }}>Category</th>
                  <th style={{ padding: "12px 10px", color: "#0f172a", fontWeight: 700 }}>Status</th>
                  <th style={{ padding: "12px 10px", textAlign: "right", color: "#0f172a", fontWeight: 700 }}>Qty Sold</th>
                  <th style={{ padding: "12px 10px", textAlign: "right", color: "#0f172a", fontWeight: 700 }}>Orders</th>
                  <th style={{ padding: "12px 10px", textAlign: "right", color: "#0f172a", fontWeight: 700 }}>Order Value (₹)</th>
                  <th style={{ padding: "12px 10px", color: "#0f172a", fontWeight: 700 }}>Period Rating</th>
                  <th style={{ padding: "12px 10px", color: "#0f172a", fontWeight: 700 }}>Last Sold (IST)</th>
                  <th style={{ padding: "12px 10px", color: "#0f172a", fontWeight: 700 }}>Feedback</th>
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
                        borderBottom: "1px solid #e2e8f0",
                        background: isTopSeller ? "rgba(59,130,246,0.04)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "12px 10px" }}>
                        <strong style={{ color: "#0f172a", fontSize: "0.92rem", fontWeight: 700 }}>{dish.name}</strong>
                        {isTopSeller && <span className="dish-badge-bestseller">Best Seller</span>}
                        {isTopRated && <span className="dish-badge-toprated">Top Rated</span>}
                        {!dish.onCurrentMenu && (
                          <span style={{ fontSize: "0.68rem", color: "#64748b", marginLeft: 6, fontWeight: 500 }}>
                            (Unlisted)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 10px", color: "#334155", fontWeight: 600 }}>{dish.category}</td>
                      <td style={{ padding: "12px 10px" }}>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontWeight: 700,
                            background: dish.currentlyAvailable
                              ? "#d1fae5"
                              : "#fee2e2",
                            color: dish.currentlyAvailable ? "#065f46" : "#991b1b",
                            border: dish.currentlyAvailable ? "1px solid #a7f3d0" : "1px solid #fecaca",
                          }}
                        >
                          {dish.currentlyAvailable ? "Available" : "Sold out"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 10px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                        {dish.quantitySold}
                      </td>
                      <td style={{ padding: "12px 10px", textAlign: "right", color: "#334155", fontWeight: 600 }}>
                        {dish.ordersCount}
                      </td>
                      <td style={{ padding: "12px 10px", textAlign: "right", fontWeight: 700, color: "#047857" }}>
                        {money(dish.salesValue)}
                      </td>
                      <td style={{ padding: "12px 10px" }}>
                        {dish.periodAvgRating !== null ? (
                          <span style={{ color: "#92400e", fontWeight: 700, background: "#fef3c7", padding: "2px 6px", borderRadius: 4, border: "1px solid #fde68a" }}>
                            ★ {dish.periodAvgRating.toFixed(1)}{" "}
                            <small style={{ color: "#78350f" }}>({dish.periodRatingsCount})</small>
                          </span>
                        ) : dish.allTimeRatingsCount > 0 ? (
                          <span style={{ fontSize: "0.78rem", color: "#475569", fontWeight: 500 }}>
                            ★ {dish.allTimeAvgRating.toFixed(1)} <small>(all-time)</small>
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                            Not rated yet
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 10px", color: "#475569", fontSize: "0.78rem", fontWeight: 500 }}>
                        {dish.lastSoldAt ? orderTime(dish.lastSoldAt) : "—"}
                      </td>
                      <td style={{ padding: "12px 10px" }}>
                        {dish.latestComments.length > 0 ? (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => setSelectedDishFeedback(dish)}
                            style={{ fontSize: "0.75rem", padding: "4px 8px", color: "#0f172a", borderColor: "#cbd5e1" }}
                          >
                            <MessageSquare size={12} style={{ marginRight: 4 }} />
                            {dish.latestComments.length} comment{dish.latestComments.length > 1 ? "s" : ""}
                          </button>
                        ) : (
                          <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
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
        <div style={{ marginTop: 18, fontSize: "0.76rem", color: "#475569", borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
          ℹ️ {data?.summary.unsold.note}
        </div>
      </div>

      {/* Legal & Accounting Disclaimer */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          padding: 14,
          fontSize: "0.78rem",
          color: "#475569",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        }}
      >
        ⚖️ {data?.disclaimer}
      </div>

      {/* Private Customer Feedback Dialog */}
      <Dialog open={!!selectedDishFeedback} onOpenChange={(v) => !v && setSelectedDishFeedback(null)}>
        <DialogContent className="editor-modal" style={{ maxWidth: 520, background: "#fff", color: "#0f172a" }}>
          <DialogTitle style={{ color: "#0f172a" }}>Private Feedback for {selectedDishFeedback?.name}</DialogTitle>
          <DialogDescription style={{ color: "#475569" }}>
            Confidential guest ratings and comments submitted for delivered orders.
          </DialogDescription>

          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {selectedDishFeedback?.latestComments.map((c, i) => (
              <div
                key={i}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "10px 14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#b45309", fontWeight: 700, fontSize: "0.85rem" }}>
                    ★ {c.rating} / 5
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                    {orderTime(c.date)} IST
                  </span>
                </div>
                <p style={{ marginTop: 6, fontSize: "0.85rem", color: "#0f172a" }}>
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

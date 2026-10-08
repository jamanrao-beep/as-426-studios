"use client";

import { useEffect, useState } from "react";
import { Sparkles, Check, ExternalLink, Calendar, Bell, ChevronRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface InsightNotification {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  date: string;
  best_seller_id: string | null;
  best_seller_name: string | null;
  best_seller_qty: number;
  top_rated_id: string | null;
  top_rated_name: string | null;
  top_rated_score: number | null;
  top_rated_count: number;
  zero_sales_count: number;
  zero_sales_dishes: string[];
  summary_text: string;
  created_at: string;
  is_read: boolean;
}

export default function DishInsights({
  restaurant,
  onOpenReport,
}: {
  restaurant?: string;
  onOpenReport: (restaurantId?: string, date?: string) => void;
}) {
  const [notifications, setNotifications] = useState<InsightNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatorNote, setGeneratorNote] = useState("");

  async function loadInsights() {
    setLoading(true);
    try {
      const url = restaurant
        ? `/api/dish-insights?restaurant=${encodeURIComponent(restaurant)}`
        : "/api/dish-insights";
      const res = await fetch(url);
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to load insights");
      setNotifications(data.notifications || []);
      setGeneratorNote(data.generatorNote || "");
    } catch (err: any) {
      console.error("Could not load insights:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInsights();
  }, [restaurant]);

  async function markAsRead(id: string) {
    try {
      const res = await fetch("/api/dish-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", notificationId: id }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        toast.success("Notification marked as read");
      }
    } catch {
      toast.error("Failed to update notification");
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", paddingBottom: 30 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <span className="access-badge" style={{ background: "rgba(139,92,246,0.15)", color: "#c084fc", border: "none" }}>
            <Sparkles size={16} /> DISH INSIGHTS NOTIFICATIONS
          </span>
          <h2 style={{ fontSize: "1.4rem", marginTop: 6, marginBottom: 4 }}>Daily Menu Summaries</h2>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Automated daily dish performance recaps calculated at midnight Asia/Kolkata time.
          </p>
        </div>

        {unreadCount > 0 && (
          <span
            style={{
              fontSize: "0.78rem",
              background: "#3b82f6",
              color: "#fff",
              padding: "4px 10px",
              borderRadius: 12,
              fontWeight: 600,
            }}
          >
            {unreadCount} unread
          </span>
        )}
      </div>

      {loading ? (
        <p className="muted">Loading daily insights...</p>
      ) : notifications.length === 0 ? (
        <div className="empty" style={{ padding: 32 }}>
          <Bell size={28} style={{ margin: "0 auto 12px auto", opacity: 0.5 }} />
          <h3>No daily summaries recorded yet.</h3>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Summaries are generated after each day concludes in Asia/Kolkata time.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {notifications.map((n) => (
            <div
              key={n.id}
              style={{
                background: n.is_read ? "rgba(255,255,255,0.02)" : "rgba(139,92,246,0.06)",
                border: `1px solid ${n.is_read ? "rgba(255,255,255,0.06)" : "rgba(139,92,246,0.3)"}`,
                borderRadius: 12,
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {!n.is_read && (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#a855f7",
                        display: "inline-block",
                      }}
                    />
                  )}
                  <strong style={{ fontSize: "0.95rem", color: "#fff" }}>
                    {n.restaurant_name || n.restaurant_id}
                  </strong>
                  <span className="muted" style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 4 }}>
                    <Calendar size={13} /> {n.date} (IST)
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {!n.is_read && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => markAsRead(n.id)}
                      style={{ fontSize: "0.74rem", padding: "4px 8px" }}
                    >
                      <Check size={12} style={{ marginRight: 3 }} /> Mark as read
                    </button>
                  )}
                  <button
                    type="button"
                    className="primary"
                    onClick={() => onOpenReport(n.restaurant_id, n.date)}
                    style={{ fontSize: "0.75rem", padding: "5px 10px" }}
                  >
                    View Report <ChevronRight size={13} />
                  </button>
                </div>
              </div>

              <p style={{ fontSize: "0.88rem", color: "#e2e8f0", margin: 0 }}>
                {n.summary_text}
              </p>

              {n.zero_sales_count > 0 && n.zero_sales_dishes.length > 0 && (
                <div style={{ fontSize: "0.76rem", color: "#94a3b8" }}>
                  Available dishes with zero sales: {n.zero_sales_dishes.slice(0, 4).join(", ")}
                  {n.zero_sales_dishes.length > 4 && ` and ${n.zero_sales_dishes.length - 4} more`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {generatorNote && (
        <p className="muted" style={{ fontSize: "0.75rem", marginTop: 18 }}>
          ℹ️ {generatorNote}
        </p>
      )}
    </div>
  );
}

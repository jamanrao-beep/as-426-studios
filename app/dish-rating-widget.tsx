"use client";

import { useEffect, useState } from "react";
import { Star, Check, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import type { StoredOrder } from "@/lib/orders";

interface SavedRating {
  dish_id: string;
  dish_name: string;
  rating: number;
  comment: string;
  updated_at: string;
}

export default function DishRatingWidget({
  order,
  token,
  restaurant,
}: {
  order: StoredOrder;
  token?: string;
  restaurant: string;
}) {
  const [open, setOpen] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});
  const [busyDish, setBusyDish] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load existing ratings for this order
  useEffect(() => {
    if (!open || !token || loaded) return;
    async function fetchRatings() {
      try {
        const res = await fetch(
          `/api/dish-ratings?restaurant=${encodeURIComponent(restaurant)}&order_id=${encodeURIComponent(
            order.id
          )}&token=${encodeURIComponent(token!)}`
        );
        const data = (await res.json()) as any;
        if (res.ok && data.ratings) {
          const rMap: Record<string, number> = {};
          const cMap: Record<string, string> = {};
          const sMap: Record<string, boolean> = {};

          for (const item of data.ratings as SavedRating[]) {
            rMap[item.dish_id] = item.rating;
            cMap[item.dish_id] = item.comment || "";
            sMap[item.dish_id] = true;
          }

          setRatings((prev) => ({ ...rMap, ...prev }));
          setComments((prev) => ({ ...cMap, ...prev }));
          setSavedStatus((prev) => ({ ...sMap, ...prev }));
        }
      } catch (err) {
        console.error("Could not load ratings:", err);
      } finally {
        setLoaded(true);
      }
    }
    fetchRatings();
  }, [open, token, restaurant, order.id, loaded]);

  if (order.status !== "served") {
    return null;
  }

  async function handleSaveRating(dishId: string) {
    if (!token) {
      toast.error("Order security token missing.");
      return;
    }

    const starCount = ratings[dishId];
    if (!starCount || starCount < 1 || starCount > 5) {
      toast.error("Please select a star rating (1 to 5).");
      return;
    }

    setBusyDish(dishId);
    try {
      const res = await fetch("/api/dish-ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant,
          orderId: order.id,
          token,
          dishId,
          rating: starCount,
          comment: comments[dishId] || "",
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to submit rating");

      setSavedStatus((prev) => ({ ...prev, [dishId]: true }));
      toast.success("Dish rating saved! Thank you.");
    } catch (err: any) {
      toast.error(err.message || "Failed to save rating");
    } finally {
      setBusyDish(null);
    }
  }

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 12,
        borderTop: "1px dashed rgba(255,255,255,0.15)",
      }}
    >
      <button
        type="button"
        className="secondary"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderRadius: 8,
          fontSize: "0.85rem",
          background: open ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Star size={15} style={{ color: "#fbbf24", fill: "#fbbf24" }} />
          <strong>Rate your food</strong>
          <small className="muted" style={{ marginLeft: 4 }}>
            (Delivered to your table)
          </small>
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          <p className="muted" style={{ fontSize: "0.78rem", margin: "0 0 4px 0" }}>
            How was each dish? Your honest ratings help our kitchen team perfect their craft.
          </p>

          {order.items.map((item) => {
            const currentStar = ratings[item.id] || 0;
            const currentComment = comments[item.id] || "";
            const isSaved = savedStatus[item.id];
            const isBusy = busyDish === item.id;

            return (
              <div
                key={item.id}
                style={{
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "0.88rem" }}>{item.name}</strong>
                  {isSaved && (
                    <span
                      style={{
                        fontSize: "0.72rem",
                        color: "#6ee7b7",
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <Check size={12} /> Rated {currentStar}★
                    </span>
                  )}
                </div>

                {/* 1 to 5 Star Rating Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                  {[1, 2, 3, 4, 5].map((s) => {
                    const active = s <= currentStar;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setRatings((prev) => ({ ...prev, [item.id]: s }));
                          setSavedStatus((prev) => ({ ...prev, [item.id]: false }));
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          padding: 2,
                          cursor: "pointer",
                          transition: "transform 0.1s ease",
                        }}
                        title={`Rate ${s} star${s > 1 ? "s" : ""}`}
                      >
                        <Star
                          size={22}
                          style={{
                            color: active ? "#fbbf24" : "rgba(255,255,255,0.25)",
                            fill: active ? "#fbbf24" : "transparent",
                          }}
                        />
                      </button>
                    );
                  })}
                  <span style={{ fontSize: "0.8rem", color: "#a5b4a9", marginLeft: 4 }}>
                    {currentStar > 0 ? `${currentStar} / 5` : "Tap to rate"}
                  </span>
                </div>

                {/* Optional Written Comment */}
                <div style={{ marginTop: 8 }}>
                  <input
                    type="text"
                    maxLength={500}
                    value={currentComment}
                    onChange={(e) => {
                      setComments((prev) => ({ ...prev, [item.id]: e.target.value }));
                      setSavedStatus((prev) => ({ ...prev, [item.id]: false }));
                    }}
                    placeholder="Optional comment for the chef..."
                    style={{
                      width: "100%",
                      fontSize: "0.8rem",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      padding: "6px 10px",
                      color: "#fff",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button
                    type="button"
                    className="primary"
                    disabled={isBusy || currentStar === 0 || isSaved}
                    onClick={() => handleSaveRating(item.id)}
                    style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                  >
                    {isBusy ? "Saving..." : isSaved ? "Saved ✓" : "Submit Rating"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

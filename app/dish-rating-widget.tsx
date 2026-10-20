"use client";

import { useEffect, useState } from "react";
import { Star, Check, ChevronDown, ChevronUp, Sparkles, MessageSquare } from "lucide-react";
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
  const [hoverStars, setHoverStars] = useState<Record<string, number>>({});
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

  const allRated = order.items.length > 0 && order.items.every((it) => savedStatus[it.id]);

  return (
    <div
      style={{
        marginTop: 18,
        paddingTop: 16,
        borderTop: "1px dashed #e3d3cc",
      }}
    >
      {/* Header Expand/Collapse Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderRadius: 12,
          border: "1px solid #e8dbd5",
          background: open ? "#f9f3f1" : "#ffffff",
          cursor: "pointer",
          transition: "all 0.18s ease",
          textAlign: "left",
          boxShadow: open ? "0 2px 8px rgba(37,25,19,0.04)" : "0 1px 3px rgba(37,25,19,0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: allRated ? "#ecfdf5" : "#fef3c7",
              color: allRated ? "#059669" : "#d97706",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {allRated ? (
              <Check size={18} style={{ strokeWidth: 2.5 }} />
            ) : (
              <Star size={18} style={{ fill: "#d97706" }} />
            )}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#251913" }}>
                {allRated ? "Dishes Rated" : "Rate your dishes"}
              </span>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: allRated ? "#d1fae5" : "#f7e8e2",
                  color: allRated ? "#065f46" : "#62321e",
                }}
              >
                {allRated ? "Completed" : "Delivered"}
              </span>
            </div>
            <p style={{ fontSize: "0.78rem", color: "#6b786f", margin: "2px 0 0" }}>
              {allRated
                ? "Thank you for sharing your feedback with the kitchen team!"
                : "Help the culinary team perfect each dish on your table"}
            </p>
          </div>
        </div>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: open ? "#eee2dd" : "#f7efec",
            color: "#52382d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.18s ease",
          }}
        >
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded Rating Cards */}
      {open && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
          <p
            style={{
              fontSize: "0.8rem",
              color: "#6b786f",
              margin: "0 2px",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Sparkles size={14} style={{ color: "#b65e38" }} />
            How was each item? Select stars and leave a note for the chefs:
          </p>

          {order.items.map((item) => {
            const currentStar = ratings[item.id] || 0;
            const hovered = hoverStars[item.id] !== undefined;
            const displayStar = hovered ? hoverStars[item.id] : currentStar;
            const currentComment = comments[item.id] || "";
            const isSaved = savedStatus[item.id];
            const isBusy = busyDish === item.id;

            return (
              <div
                key={item.id}
                style={{
                  background: "#ffffff",
                  border: isSaved ? "1.5px solid #a7f3d0" : "1.5px solid #ebe0dc",
                  borderRadius: 14,
                  padding: "16px 18px",
                  boxShadow: isSaved
                    ? "0 3px 12px rgba(16,185,129,0.06)"
                    : "0 2px 10px rgba(37,25,19,0.03)",
                  transition: "all 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {/* Dish Name & Saved Tag */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: isSaved ? "#10b981" : "#bd623b",
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    <strong
                      style={{
                        fontSize: "0.98rem",
                        color: "#251913",
                        fontWeight: 700,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {item.name}
                    </strong>
                    {item.quantity > 1 && (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "#795f54",
                          background: "#f5edea",
                          padding: "2px 7px",
                          borderRadius: 6,
                          fontWeight: 600,
                        }}
                      >
                        ×{item.quantity}
                      </span>
                    )}
                  </div>

                  {isSaved && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#059669",
                        background: "#ecfdf5",
                        border: "1px solid #a7f3d0",
                        padding: "3px 10px",
                        borderRadius: 20,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Check size={13} style={{ strokeWidth: 2.5 }} /> Rated {currentStar}★
                    </span>
                  )}
                </div>

                {/* 1 to 5 Star Rating Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    {[1, 2, 3, 4, 5].map((s) => {
                      const active = s <= displayStar;
                      return (
                        <button
                          key={s}
                          type="button"
                          onMouseEnter={() => setHoverStars((prev) => ({ ...prev, [item.id]: s }))}
                          onMouseLeave={() =>
                            setHoverStars((prev) => {
                              const copy = { ...prev };
                              delete copy[item.id];
                              return copy;
                            })
                          }
                          onClick={() => {
                            setRatings((prev) => ({ ...prev, [item.id]: s }));
                            setSavedStatus((prev) => ({ ...prev, [item.id]: false }));
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            padding: "4px 3px",
                            cursor: "pointer",
                            transition: "transform 0.12s ease",
                            transform: active ? "scale(1.12)" : "scale(1)",
                          }}
                          title={`Rate ${s} star${s > 1 ? "s" : ""}`}
                        >
                          <Star
                            size={26}
                            style={{
                              color: active ? "#f59e0b" : "#dccfc9",
                              fill: active ? "#f59e0b" : "transparent",
                              filter: active
                                ? "drop-shadow(0 2px 4px rgba(245,158,11,0.32))"
                                : "none",
                              transition: "all 0.15s ease",
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>

                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 16,
                      transition: "all 0.15s ease",
                      ...(displayStar === 0
                        ? { background: "#f8f2ef", color: "#8a6c5f" }
                        : displayStar <= 2
                        ? { background: "#fef3c7", color: "#92400e" }
                        : displayStar <= 4
                        ? { background: "#fce2cb", color: "#623712" }
                        : { background: "#fef9c3", color: "#854d0e", border: "1px solid #fde047" }),
                    }}
                  >
                    {displayStar === 0
                      ? "Tap to rate"
                      : displayStar === 1
                      ? "1 / 5 · Needs improvement"
                      : displayStar === 2
                      ? "2 / 5 · Fair"
                      : displayStar === 3
                      ? "3 / 5 · Good"
                      : displayStar === 4
                      ? "4 / 5 · Delicious! 😋"
                      : "5 / 5 · Exceptional! 🌟"}
                  </span>
                </div>

                {/* Optional Written Comment */}
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    maxLength={500}
                    value={currentComment}
                    onChange={(e) => {
                      setComments((prev) => ({ ...prev, [item.id]: e.target.value }));
                      setSavedStatus((prev) => ({ ...prev, [item.id]: false }));
                    }}
                    placeholder="Optional note for the chef (e.g. perfectly spiced, great portion)..."
                    style={{
                      width: "100%",
                      fontSize: "0.85rem",
                      background: "#fcf9f8",
                      border: "1px solid #e3d3cc",
                      borderRadius: 9,
                      padding: "9px 12px",
                      color: "#251913",
                      outline: "none",
                      transition: "all 0.15s ease",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.background = "#ffffff";
                      e.currentTarget.style.borderColor = "#a55634";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(165,86,52,0.15)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.background = "#fcf9f8";
                      e.currentTarget.style.borderColor = "#e3d3cc";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>

                {/* Bottom Action Row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 2,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: "0.74rem", color: "#9f8073" }}>
                    {currentComment.length > 0
                      ? `${currentComment.length}/500 chars`
                      : "Ratings are sent privately to the restaurant"}
                  </span>

                  <button
                    type="button"
                    disabled={isBusy || currentStar === 0 || isSaved}
                    onClick={() => handleSaveRating(item.id)}
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      padding: "8px 16px",
                      borderRadius: 8,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: isBusy || currentStar === 0 || isSaved ? "not-allowed" : "pointer",
                      transition: "all 0.15s ease",
                      ...(isSaved
                        ? {
                            background: "#ecfdf5",
                            color: "#059669",
                            border: "1px solid #a7f3d0",
                          }
                        : currentStar === 0
                        ? {
                            background: "#f0e6e2",
                            color: "#a2867a",
                            border: "none",
                          }
                        : {
                            background: "#291a13",
                            color: "#ffffff",
                            border: "none",
                            boxShadow: "0 2px 6px rgba(41,26,19,0.18)",
                          }),
                    }}
                  >
                    {isBusy ? (
                      "Saving..."
                    ) : isSaved ? (
                      <>
                        <Check size={14} style={{ strokeWidth: 2.5 }} /> Saved
                      </>
                    ) : (
                      "Submit Rating"
                    )}
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

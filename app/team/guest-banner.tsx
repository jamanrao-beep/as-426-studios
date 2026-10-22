"use client";

import { Sparkles } from "lucide-react";

const left = (iso: string | null) => {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "ends today";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d} day${d === 1 ? "" : "s"} left` : `${h} hour${h === 1 ? "" : "s"} left`;
};

// Shown above a guest's workspace: how long the sandbox lasts, what is limited, and the way to a real account. The limits
// come from the server, which also enforces them.
export default function GuestBanner({ expiresAt, limits }: { expiresAt: string | null; limits: { dishes: number; waiters: number } | null }) {
  return (
    <div
      role="status"
      style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", background: "#fff7f1", border: "1px solid #f5d5c0", borderRadius: 14, padding: "10px 16px", margin: "0 0 12px" }}
    >
      <Sparkles size={18} color="#c2410c" />
      <span style={{ flex: "1 1 260px", fontSize: "0.9rem", lineHeight: 1.5 }}>
        <strong>Guest sandbox{expiresAt ? ` · ${left(expiresAt)}` : ""}.</strong>{" "}
        {limits ? `Up to ${limits.dishes} dishes and ${limits.waiters} staff account. ` : ""}Register your restaurant to remove the limits and start your free trial.
      </span>
      <a href="/apply" style={{ background: "#c2410c", color: "#fff", fontWeight: 800, borderRadius: 12, padding: "10px 18px", textDecoration: "none", minHeight: 40, display: "inline-flex", alignItems: "center" }}>
        Register my restaurant
      </a>
      <a href="/api/auth/logout?return_to=/login" style={{ color: "#57534e", fontWeight: 700, fontSize: "0.88rem" }}>
        Sign out
      </a>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Utensils, LogOut, UserCheck } from "lucide-react";
import Orders from "./orders";
import OrderAlerts from "./order-alerts";

export default function WaiterWorkspace({ email }: { email: string }) {
  const [restaurant, setRestaurant] = useState<string | undefined>();

  return (
    <div className="waiter-workspace">
      <header className="brandbar">
        <span className="brand">
          <span className="brandmark">
            <Utensils size={20} />
          </span>
          AS 426 <span className="muted">STUDIOS</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="role-badge">
            <UserCheck size={12} />
            Staff / Waiter
          </span>
          <a className="quiet-link signout-btn" href="/api/auth/logout?return_to=/login">
            <LogOut size={14} />
            Sign out
          </a>
        </div>
      </header>
      <main>
        <p className="eyebrow">STAFF ORDERS WORKSPACE · LIVE TABLES</p>
        <h1>Your tables, at a glance.</h1>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "22px" }}>
          <p className="muted waiter-login" style={{ margin: 0 }}>
            Signed in as <strong>{email}</strong>
          </p>
          <a className="waiter-switch-link" href="/api/auth/logout?return_to=/login">
            Switch to Admin
          </a>
        </div>
        <OrderAlerts onOpen={setRestaurant} />
        {restaurant && (
          <button
            className="secondary"
            style={{ marginBottom: "16px" }}
            onClick={() => setRestaurant(undefined)}
          >
            Show all assigned orders
          </button>
        )}
        <Orders key={restaurant || "all"} restaurant={restaurant} />
      </main>
    </div>
  );
}

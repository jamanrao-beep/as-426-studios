"use client";

import { LogOut } from "lucide-react";
import Billing from "./billing";

// A restaurant whose plan has ended can still sign in, see why, and request a plan. Everything else stays locked
// on the server until the Super Admin activates a plan.
export default function PlanLocked({ message }: { message: string }) {
  return (
    <main className="access" style={{ alignItems: "flex-start", maxWidth: 680, margin: "0 auto", padding: "40px 20px" }}>
      <h1>Your plan has ended</h1>
      <p className="muted">{message} Your menu, orders and team are kept safe.</p>
      <Billing />
      <p>
        <a className="quiet-link" href="/api/auth/logout?return_to=/login">
          <LogOut size={14} /> Sign out
        </a>
      </p>
    </main>
  );
}

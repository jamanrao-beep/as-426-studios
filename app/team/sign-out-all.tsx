"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

// Lost a phone, or signed in on a shared computer? This ends every session for the account at once.
export default function SignOutAll() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="quiet-link"
      disabled={busy}
      title="End every session for this account, on every device"
      style={{ background: "none", border: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, color: "#57534e" }}
      onClick={async () => {
        if (!window.confirm("Sign out of all devices? Everyone using this account, including your phone, will need to sign in again.")) return;
        setBusy(true);
        try {
          await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ everywhere: true }) });
        } finally {
          window.location.href = "/api/auth/logout?return_to=/login";
        }
      }}
    >
      <LogOut size={14} /> All devices
    </button>
  );
}

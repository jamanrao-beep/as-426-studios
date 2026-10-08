"use client";

import { useState } from "react";
import { Utensils, LogOut, UserCheck, Key, Lock, Eye, EyeOff } from "lucide-react";
import Orders from "./orders";
import OrderAlerts from "./order-alerts";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function WaiterWorkspace({
  email,
  assignedRestaurant,
  isWaiter = true,
}: {
  email: string;
  assignedRestaurant?: string;
  isWaiter?: boolean;
}) {
  const [changePassOpen, setChangePassOpen] = useState(false);
  const [currPass, setCurrPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [passBusy, setPassBusy] = useState(false);
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!currPass || !newPass || !confirmPass) {
      setPassError("Please fill all fields.");
      return;
    }
    if (newPass.length < 6) {
      setPassError("New password must be at least 6 characters.");
      return;
    }
    if (newPass !== confirmPass) {
      setPassError("New password and confirm password do not match.");
      return;
    }

    setPassError("");
    setPassBusy(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currPass, newPassword: newPass }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to change password.");

      setPassSuccess("Password updated successfully.");
      setCurrPass("");
      setNewPass("");
      setConfirmPass("");
      setTimeout(() => {
        setPassSuccess("");
        setChangePassOpen(false);
      }, 1500);
    } catch (err: any) {
      setPassError(err?.message || "Failed to change password.");
    } finally {
      setPassBusy(false);
    }
  }

  return (
    <div className="waiter-workspace">
      <header className="brandbar">
        <span className="brand">
          <span className="brandmark">
            <Utensils size={20} />
          </span>
          TABLE SECRET <span className="muted">/ AS 426</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span className="role-badge">
            <UserCheck size={12} />
            Staff / Waiter
          </span>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setPassError("");
              setPassSuccess("");
              setChangePassOpen(true);
            }}
            style={{ fontSize: "0.8rem", padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: "5px" }}
          >
            <Key size={13} /> Change Password
          </button>
          <a className="quiet-link signout-btn" href="/api/auth/logout?return_to=/login">
            <LogOut size={14} />
            Sign out
          </a>
        </div>
      </header>

      <main>
        <p className="eyebrow">ORDERS-ONLY WORKSPACE · LIVE TABLE FEED</p>
        <h1>Table Orders & Delivery Confirmation</h1>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "22px" }}>
          <p className="muted waiter-login" style={{ margin: 0 }}>
            Signed in as <strong>{email}</strong>
            {assignedRestaurant && (
              <span> · Assigned Restaurant: <strong>{assignedRestaurant}</strong></span>
            )}
          </p>
        </div>

        {assignedRestaurant && <OrderAlerts onOpen={() => {}} />}
        <Orders
          key={assignedRestaurant || "all"}
          restaurant={assignedRestaurant}
          canEdit={false}
          isWaiter={isWaiter}
        />
      </main>

      {/* Change Password Dialog */}
      <Dialog open={changePassOpen} onOpenChange={setChangePassOpen}>
        <DialogContent className="editor-modal">
          <DialogTitle>Change Your Password</DialogTitle>
          <DialogDescription>
            Enter your current password and choose a new secure password.
          </DialogDescription>

          {passError && <p className="error" role="alert">{passError}</p>}
          {passSuccess && <p className="success-note" role="status">{passSuccess}</p>}

          <form onSubmit={handlePasswordChange}>
            <label>
              Current Password
              <input
                type={showPass ? "text" : "password"}
                required
                value={currPass}
                onChange={(e) => setCurrPass(e.target.value)}
                disabled={passBusy}
              />
            </label>

            <label>
              New Password (min 6 characters)
              <input
                type={showPass ? "text" : "password"}
                required
                minLength={6}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                disabled={passBusy}
              />
            </label>

            <label>
              Confirm New Password
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type={showPass ? "text" : "password"}
                  required
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  disabled={passBusy}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowPass(!showPass)}
                  title={showPass ? "Hide" : "Show"}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
              <button type="button" className="secondary" onClick={() => setChangePassOpen(false)} disabled={passBusy}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={passBusy}>
                {passBusy ? "Updating…" : "Update Password"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

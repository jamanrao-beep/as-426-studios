"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Key, LogOut, UserCheck, Utensils } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import OrdersBoard from "./orders-board";
import HelpChat from "./help-chat";

// The waiter's website workspace: a slim header and the shared orders screen, the same one managers use and the
// same flow as the phone app. What a waiter may do (cancel, history) follows the Super Admin's switches.
export default function WaiterWorkspace({
  email,
  name,
  assignedRestaurant,
  restaurantName,
  isWaiter = true,
}: {
  email: string;
  name?: string;
  assignedRestaurant?: string;
  restaurantName?: string;
  isWaiter?: boolean;
}) {
  const displayName = name || email;
  const displayRestaurant = restaurantName || assignedRestaurant || "";
  const [perm, setPerm] = useState({ cancel: true, history: true });
  const [changePassOpen, setChangePassOpen] = useState(false);
  const [currPass, setCurrPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [passBusy, setPassBusy] = useState(false);
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");

  useEffect(() => {
    fetch("/api/app-config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: any) => {
        const w = d?.restaurant?.waiter;
        if (w && isWaiter) setPerm({ cancel: w.cancelOrders !== false, history: w.orderHistory !== false });
      })
      .catch(() => {});
  }, [isWaiter]);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!currPass || !newPass || !confirmPass) return setPassError("Please fill all password fields.");
    if (newPass.length < 6) return setPassError("New password must be at least 6 characters.");
    if (newPass !== confirmPass) return setPassError("New password and confirmation do not match.");
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
      setPassSuccess("Password updated. Your other devices were signed out.");
      setCurrPass("");
      setNewPass("");
      setConfirmPass("");
      setTimeout(() => {
        setPassSuccess("");
        setChangePassOpen(false);
      }, 1800);
    } catch (err: any) {
      setPassError(err?.message || "Failed to change password.");
    } finally {
      setPassBusy(false);
    }
  }

  return (
    <div className="waiter-workspace-container">
      <header className="waiter-topbar">
        <div className="waiter-topbar-left">
          <div className="waiter-brand">
            <span className="waiter-brand-icon">
              <Utensils size={18} />
            </span>
            <div className="waiter-brand-text">
              <span className="waiter-restaurant-title">{displayRestaurant}</span>
              <span className="waiter-brand-subtitle">Table Secret · Staff workspace</span>
            </div>
          </div>
        </div>
        <div className="waiter-topbar-right">
          <div className="waiter-user-info">
            <span className="waiter-user-name">
              <UserCheck size={13} />
              {displayName}
            </span>
            <span className="waiter-user-email">{email}</span>
          </div>
          <div className="waiter-topbar-actions">
            {isWaiter && <HelpChat role="waiter" name={name} />}
            <button type="button" className="waiter-header-btn" onClick={() => { setPassError(""); setPassSuccess(""); setChangePassOpen(true); }} title="Change your password">
              <Key size={14} />
              <span>Password</span>
            </button>
            <a className="waiter-header-btn signout" href="/api/auth/logout?return_to=/login" title="Sign out">
              <LogOut size={14} />
              <span>Sign out</span>
            </a>
          </div>
        </div>
      </header>

      <main className="waiter-main-content">
        {assignedRestaurant ? (
          <OrdersBoard restaurant={assignedRestaurant} canManage={!isWaiter} canCancel={perm.cancel} canHistory={perm.history} />
        ) : (
          <p className="error">Your account is not assigned to a restaurant yet. Ask your manager.</p>
        )}
      </main>

      <Dialog open={changePassOpen} onOpenChange={setChangePassOpen}>
        <DialogContent className="editor-modal">
          <DialogTitle>Change your password</DialogTitle>
          <DialogDescription>This is your Table Secret password, separate from any personal email password.</DialogDescription>
          {passError && <p className="error" role="alert">{passError}</p>}
          {passSuccess && <p className="success-note" role="status">{passSuccess}</p>}
          <form onSubmit={handlePasswordChange}>
            <label>
              Current password
              <input type={showPass ? "text" : "password"} required value={currPass} onChange={(e) => setCurrPass(e.target.value)} disabled={passBusy} autoComplete="current-password" />
            </label>
            <label>
              New password (at least 6 characters)
              <input type={showPass ? "text" : "password"} required minLength={6} value={newPass} onChange={(e) => setNewPass(e.target.value)} disabled={passBusy} autoComplete="new-password" />
            </label>
            <label>
              Confirm new password
              <div style={{ display: "flex", gap: 8 }}>
                <input type={showPass ? "text" : "password"} required value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} disabled={passBusy} style={{ flex: 1 }} autoComplete="new-password" />
                <button type="button" className="secondary" onClick={() => setShowPass(!showPass)} aria-label={showPass ? "Hide passwords" : "Show passwords"}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button type="button" className="secondary" onClick={() => setChangePassOpen(false)} disabled={passBusy}>Cancel</button>
              <button type="submit" className="primary" disabled={passBusy}>{passBusy ? "Updating…" : "Update password"}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

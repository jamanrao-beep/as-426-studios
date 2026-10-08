"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, ShieldAlert, ArrowRight, Utensils } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all password fields.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Your new password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("New password must be different from your temporary password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password.");
      }

      setSuccess(true);
      setTimeout(() => {
        const dest = data.user?.role === "waiter" ? "/team/orders" : "/team";
        router.push(dest);
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "Failed to update password. Please check your current password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <header className="brandbar login-brandbar">
        <a className="brand" href="/">
          <span className="brandmark">
            <Utensils size={20} />
          </span>
          AS 426 <span className="muted">STUDIOS</span>
        </a>
      </header>

      <main className="login-main">
        <div className="login-card" style={{ maxWidth: 440 }}>
          <div className="login-header">
            <span className="pill login-pill">
              <ShieldAlert size={12} />
              FIRST-TIME SIGN IN REQUIREMENT
            </span>
            <h1>Set Your New Password</h1>
            <p>
              Your account was created with a temporary password. Please choose a new secure password to activate your account.
            </p>
          </div>

          {error && <div className="error login-error" role="alert">{error}</div>}
          {success && (
            <div style={{ background: "#dcfce7", color: "#166534", padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "0.9rem" }}>
              Password updated successfully! Opening your dashboard…
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit}>
            <label>
              Current Temporary Password
              <div className="input-wrap">
                <Lock size={16} className="input-icon" />
                <input
                  type={showPass ? "text" : "password"}
                  required
                  placeholder="Enter temporary password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
            </label>

            <label>
              New Password (min 6 characters)
              <div className="input-wrap">
                <Lock size={16} className="input-icon" />
                <input
                  type={showPass ? "text" : "password"}
                  required
                  minLength={6}
                  placeholder="Enter new secure password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </label>

            <label>
              Confirm New Password
              <div className="input-wrap">
                <Lock size={16} className="input-icon" />
                <input
                  type={showPass ? "text" : "password"}
                  required
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? "Hide" : "Show"}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <button type="submit" className="primary login-submit" disabled={loading || success}>
              {loading ? "Updating password…" : "Save New Password & Continue"}
              <ArrowRight size={14} style={{ marginLeft: 6 }} />
            </button>
          </form>

          <footer className="login-footer-info">
            <div className="info-item">
              <span>
                Once set, your supervisor will no longer be able to view your password.
              </span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}

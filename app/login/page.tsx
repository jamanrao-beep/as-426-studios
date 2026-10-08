"use client";

import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Utensils, Shield, UserCheck, Lock, Mail, ArrowRight, Eye, EyeOff, CheckCircle2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return_to") || "/team";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const isManager = email.trim().toLowerCase() === "admin@as426.com";
  const isStaff = email.trim().toLowerCase() === "staff@as426.com";

  async function handleLogin() {
    const targetEmail = email.trim();

    if (!targetEmail) {
      setError("Please select a workspace role or enter your sign-in email.");
      return;
    }
    if (!password) {
      setError("Please enter your password to continue.");
      passwordInputRef.current?.focus();
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(data.error || "Login failed. Please check your credentials.");
      }

      // Success - navigate to destination
      router.push(returnTo);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  function selectManagerRole() {
    setEmail("admin@as426.com");
    setPassword("");
    setError("");
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 50);
  }

  function selectStaffRole() {
    setEmail("staff@as426.com");
    setPassword("");
    setError("");
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 50);
  }

  return (
    <div className="login-card">
      <div className="login-header">
        <span className="pill login-pill">
          <Lock size={12} />
          ROLE-BASED WORKSPACE ACCESS
        </span>
        <h1>Sign in to Table Secret</h1>
        <p>
          Select your workspace role or enter your credentials to open the dashboard.
        </p>
      </div>

      {error && (
        <div className="error login-error" role="alert">
          {error}
        </div>
      )}

      {/* Role Selection Quick-Toggles */}
      <div className="preset-accounts-section">
        <p className="eyebrow preset-label">1. CHOOSE WORKSPACE ROLE</p>
        <div className="preset-grid">
          <button
            type="button"
            className={`preset-card preset-admin ${isManager ? "selected" : ""}`}
            onClick={selectManagerRole}
            disabled={loading}
          >
            <div className="preset-card-top">
              <span className="preset-icon">
                <Shield size={18} />
              </span>
              <span className="preset-role-badge">
                {isManager ? "Selected ✓" : "Manager"}
              </span>
            </div>
            <h3>Restaurant Manager</h3>
            <p className="preset-desc">Full restaurant manager access: Manage menus, dishes, orders, waiters and customer reviews.</p>
            <div className="preset-action">
              <span>{isManager ? "Manager email filled · Enter password below" : "Select Restaurant Manager"}</span>
              <ArrowRight size={14} />
            </div>
          </button>

          <button
            type="button"
            className={`preset-card preset-waiter ${isStaff ? "selected" : ""}`}
            onClick={selectStaffRole}
            disabled={loading}
          >
            <div className="preset-card-top">
              <span className="preset-icon">
                <UserCheck size={18} />
              </span>
              <span className="preset-role-badge">
                {isStaff ? "Selected ✓" : "Staff"}
              </span>
            </div>
            <h3>Staff / Waiter Workspace</h3>
            <p className="preset-desc">Streamlined table orders feed, alerts and delivery confirmation.</p>
            <div className="preset-action">
              <span>{isStaff ? "Staff email filled · Enter password below" : "Select Staff"}</span>
              <ArrowRight size={14} />
            </div>
          </button>
        </div>
      </div>

      <div className="login-divider">
        <span>2. ENTER CREDENTIALS TO SIGN IN</span>
      </div>

      {/* Login Form */}
      <form
        className="login-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin();
        }}
      >
        <label>
          Email
          <div className="input-wrap">
            <Mail size={16} className="input-icon" />
            <input
              type="email"
              autoComplete="email"
              placeholder="Enter email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </label>

        <label>
          Password
          <div className="input-wrap">
            <Lock size={16} className="input-icon" />
            <input
              ref={passwordInputRef}
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        <button type="submit" className="primary login-submit" disabled={loading}>
          {loading
            ? "Signing in…"
            : isManager
            ? "Sign In as Restaurant Manager"
            : isStaff
            ? "Sign In as Staff"
            : "Sign In"}
        </button>
      </form>

      <footer className="login-footer-info">
        <div className="info-item">
          <CheckCircle2 size={15} />
          <span>
            <strong>Restaurant Managers:</strong> Full workspace to manage dishes, table orders, waiters & reviews.
          </span>
        </div>
        <div className="info-item">
          <CheckCircle2 size={15} />
          <span>
            <strong>Staff Waiters:</strong> Fast orders-only feed to review, accept and deliver table orders.
          </span>
        </div>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="login-container">
      <header className="brandbar login-brandbar">
        <a className="brand" href="/">
          <span className="brandmark">
            <Utensils size={20} />
          </span>
          AS 426 <span className="muted">STUDIOS</span>
        </a>
        <a className="quiet-link" href="/">
          ← Back to Customer Menu
        </a>
      </header>

      <main className="login-main">
        <Suspense fallback={<div className="login-card" style={{ padding: 40, textAlign: "center" }}>Loading login options…</div>}>
          <LoginForm />
        </Suspense>
      </main>

      <footer className="login-page-footer">
        AS 426 Studios · Secure Restaurant Experience Platform
      </footer>
    </div>
  );
}

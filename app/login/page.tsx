"use client";

import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Utensils, Shield, UserCheck, Lock, Mail, ArrowRight, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { PRESET_ACCOUNTS } from "@/lib/auth-constants";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return_to") || "/team";

  const [selectedRole, setSelectedRole] = useState<"admin" | "waiter">("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const passwordInputRef = useRef<HTMLInputElement>(null);

  async function handleLogin() {
    const targetEmail =
      email.trim() ||
      (selectedRole === "admin"
        ? PRESET_ACCOUNTS[0]?.email
        : PRESET_ACCOUNTS[1]?.email) ||
      "";

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

  function selectRole(role: "admin" | "waiter") {
    setSelectedRole(role);
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
          Select your workspace role and enter your password to continue.
        </p>
      </div>

      {error && (
        <div className="error login-error" role="alert">
          {error}
        </div>
      )}

      {/* Role Selection Section - Without showing any email */}
      <div className="preset-accounts-section">
        <p className="eyebrow preset-label">1. CHOOSE WORKSPACE ROLE</p>
        <div className="preset-grid">
          {PRESET_ACCOUNTS.map((acc) => {
            const isSelected = selectedRole === acc.role;
            return (
              <button
                key={acc.role}
                type="button"
                className={`preset-card ${acc.role === "admin" ? "preset-admin" : "preset-waiter"} ${isSelected ? "selected" : ""}`}
                onClick={() => selectRole(acc.role)}
                disabled={loading}
                aria-pressed={isSelected}
              >
                <div className="preset-card-top">
                  <span className="preset-icon">
                    {acc.role === "admin" ? <Shield size={18} /> : <UserCheck size={18} />}
                  </span>
                  <span className="preset-role-badge">
                    {isSelected ? "Selected ✓" : acc.role === "admin" ? "Manager / Admin" : "Staff / Waiter"}
                  </span>
                </div>
                <h3>{acc.role === "admin" ? "Manager / Admin" : "Staff / Waiter"}</h3>
                <p className="preset-desc">{acc.description}</p>
                <div className="preset-action">
                  <span>{isSelected ? "Role selected · Enter password below" : `Select ${acc.role === "admin" ? "Manager" : "Staff"}`}</span>
                  <ArrowRight size={14} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="login-divider">
        <span>2. ENTER PASSWORD TO SIGN IN</span>
      </div>

      {/* Manual / Password Login Form */}
      <form
        className="login-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin();
        }}
      >
        <label>
          Password
          <div className="input-wrap">
            <Lock size={16} className="input-icon" />
            <input
              ref={passwordInputRef}
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder={selectedRole === "admin" ? "Enter Manager password (admin123)" : "Enter Staff password (staff123)"}
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

        {/* Optional Custom Email Input for other registered accounts */}
        <details style={{ margin: "10px 0 16px", fontSize: "0.82rem", color: "#6d786f" }}>
          <summary style={{ cursor: "pointer", userSelect: "none" }}>Sign in with custom email instead</summary>
          <div style={{ marginTop: "10px" }}>
            <div className="input-wrap">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                autoComplete="email"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
        </details>

        <button type="submit" className="primary login-submit" disabled={loading}>
          {loading ? "Signing in…" : `Sign In as ${selectedRole === "admin" ? "Manager / Admin" : "Staff / Waiter"}`}
        </button>
        <p style={{ textAlign: "center", fontSize: "0.78rem", color: "#6d786f", margin: "4px 0 0" }}>
          Default passwords: Admin is <code>admin123</code> · Staff is <code>staff123</code>
        </p>
      </form>

      <footer className="login-footer-info">
        <div className="info-item">
          <CheckCircle2 size={15} />
          <span>
            <strong>Admin:</strong> Unlocks restaurant builder, menu editor, staff manager, monthly sales and reviews.
          </span>
        </div>
        <div className="info-item">
          <CheckCircle2 size={15} />
          <span>
            <strong>Waiter (Common):</strong> Streamlined mobile workspace for table orders, alerts & delivery confirmation.
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

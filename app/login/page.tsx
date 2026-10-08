"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Utensils, Shield, UserCheck, Lock, Mail, ArrowRight, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { PRESET_ACCOUNTS } from "@/lib/auth-constants";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return_to") || "/team";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(targetEmail = email, targetPass = password) {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: targetPass }),
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

  function quickFillAndSubmit(acc: (typeof PRESET_ACCOUNTS)[0]) {
    setEmail(acc.email);
    setPassword(acc.password);
    handleLogin(acc.email, acc.password);
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
          Choose a role below or enter your credentials to open your assigned workspace.
        </p>
      </div>

      {error && (
        <div className="error login-error" role="alert">
          {error}
        </div>
      )}

      {/* Quick Preset Accounts Section */}
      <div className="preset-accounts-section">
        <p className="eyebrow preset-label">SELECT ROLE (ONE-CLICK SIGN IN)</p>
        <div className="preset-grid">
          {PRESET_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              className={`preset-card ${acc.role === "admin" ? "preset-admin" : "preset-waiter"}`}
              onClick={() => quickFillAndSubmit(acc)}
              disabled={loading}
            >
              <div className="preset-card-top">
                <span className="preset-icon">
                  {acc.role === "admin" ? <Shield size={18} /> : <UserCheck size={18} />}
                </span>
                <span className="preset-role-badge">
                  {acc.role === "admin" ? "Admin / Owner" : "Common / Waiter"}
                </span>
              </div>
              <h3>{acc.displayName}</h3>
              <div className="preset-creds">
                <span>
                  <Mail size={12} /> {acc.email}
                </span>
                <span>
                  <Lock size={12} /> {acc.password}
                </span>
              </div>
              <p className="preset-desc">{acc.description}</p>
              <div className="preset-action">
                <span>Sign in as {acc.role === "admin" ? "Admin" : "Waiter"}</span>
                <ArrowRight size={14} />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="login-divider">
        <span>OR ENTER CREDENTIALS MANUALLY</span>
      </div>

      {/* Manual Login Form */}
      <form
        className="login-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin();
        }}
      >
        <label>
          Sign-in Email
          <div className="input-wrap">
            <Mail size={16} className="input-icon" />
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="name@as426.com"
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
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
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
          {loading ? "Signing in…" : "Sign In to Workspace"}
        </button>
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

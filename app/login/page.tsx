"use client";

import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Utensils, Lock, Mail, Eye, EyeOff, CheckCircle2, ArrowRight } from "lucide-react";

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

  async function handleLogin() {
    const targetEmail = email.trim();

    if (!targetEmail) {
      setError("Please enter your sign-in email.");
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

      // Success - navigate to destination based on role and change password status
      if (data.mustChangePassword) {
        router.push("/change-password");
      } else {
        const dest = data.user?.role === "waiter" ? "/team/orders" : returnTo;
        router.push(dest);
      }
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
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
          Enter your credentials to open your dashboard.
        </p>
      </div>

      {error && (
        <div className="error login-error" role="alert">
          {error}
        </div>
      )}

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
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <a className="apply-cta" href="/apply">
        <span>
          <strong>New restaurant? Apply to join</strong>
          <small>Takes two minutes. Our team verifies you and starts your free 7-day trial.</small>
        </span>
        <ArrowRight size={18} />
      </a>

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

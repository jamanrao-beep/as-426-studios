"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Plus, Trash2, Key, Copy, Check, Eye, EyeOff, User, Store } from "lucide-react";
import { toast } from "sonner";
import { SUPER_ADMIN_EMAIL } from "@/lib/auth-constants";

interface ManagerAccount {
  email: string;
  role: string;
  name: string;
  restaurant_id: string | null;
  password?: string;
  created_at: string;
}

export default function Managers({
  restaurants,
}: {
  restaurants: Array<{ id: string; name: string }>;
}) {
  const [managers, setManagers] = useState<ManagerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [restaurantId, setRestaurantId] = useState("all");
  const [showPassword, setShowPassword] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/managers");
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to load managers");
      setManagers(data.managers || []);
    } catch (err: any) {
      toast.error(err.message || "Could not load managers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function generatePassword() {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let pass = "";
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
    toast.info("Generated new password");
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Please provide both email/Gmail and password");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
          name: name.trim(),
          restaurant_id: restaurantId,
          action: "add",
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to add manager");

      toast.success(`Manager account created for ${email.trim()}`);
      setEmail("");
      setPassword("");
      setName("");
      setRestaurantId("all");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to create manager account");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(targetEmail: string) {
    if (targetEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      toast.error("Super Admin cannot be removed.");
      return;
    }

    if (!confirm(`Are you sure you want to remove manager access for ${targetEmail}?`)) {
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, action: "remove" }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to remove manager");

      toast.success("Manager access removed");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove manager");
    } finally {
      setBusy(false);
    }
  }

  function copyCredentials(m: ManagerAccount) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const text = `Table Secret Manager Login\nSign In URL: ${origin}/login\nEmail / Gmail: ${m.email}\nPassword: ${m.password || "(as configured)"}\nRole: Restaurant Manager`;

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedKey(m.email);
        toast.success("Manager login details copied! Send this to the manager.");
        setTimeout(() => setCopiedKey(null), 3000);
      })
      .catch(() => {
        toast.error("Failed to copy. Please copy manually.");
      });
  }

  return (
    <section className="form-panel" style={{ maxWidth: "880px" }}>
      <span className="access-badge" style={{ background: "#e0f2fe", color: "#0369a1" }}>
        <ShieldCheck size={18} /> SUPER ADMIN · MANAGE ADMINS & MANAGERS
      </span>
      <h2>Super Admin Manager Hub</h2>
      <p>
        Add manager Gmail accounts and set their passwords. Share the login link and password with the manager so they can sign in directly to their dashboard.
      </p>

      {/* Add Manager Form */}
      <form onSubmit={handleAdd} style={{ marginTop: "24px", background: "#f8faf6", padding: "24px", borderRadius: "14px", border: "1px solid var(--line)" }}>
        <h3 style={{ fontSize: "1.1rem", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Plus size={18} /> Add New Manager Account
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          <label>
            Manager’s Gmail / Sign-in Email *
            <input
              required
              type="email"
              placeholder="Enter email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </label>

          <label>
            Manager’s Name / Label
            <input
              type="text"
              placeholder="Enter name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginTop: "14px" }}>
          <label>
            Password for Manager *
            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              <input
                required
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="secondary"
                onClick={() => setShowPassword(!showPassword)}
                style={{ padding: "0 10px" }}
                title={showPassword ? "Hide" : "Show"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={generatePassword}
                style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}
              >
                <Key size={14} /> Auto
              </button>
            </div>
          </label>

          <label>
            Assigned Restaurant Access
            <select
              value={restaurantId}
              onChange={(e) => setRestaurantId(e.target.value)}
              disabled={busy}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                background: "#fff",
                marginTop: "6px",
                font: "inherit",
              }}
            >
              <option value="all">⭐ All Restaurants (Studio Admin Access)</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.id})
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="submit"
          className="primary"
          disabled={busy || !email.trim() || !password.trim()}
          style={{ marginTop: "20px" }}
        >
          <Plus size={16} /> {busy ? "Creating Manager…" : "Create Manager Account"}
        </button>
      </form>

      {/* Managers List */}
      <div style={{ marginTop: "32px" }}>
        <h3 style={{ fontSize: "1.2rem", marginBottom: "14px" }}>
          Registered Manager & Admin Accounts ({managers.length})
        </h3>

        {loading ? (
          <p>Loading accounts…</p>
        ) : managers.length === 0 ? (
          <p className="muted">No manager accounts found.</p>
        ) : (
          <div style={{ display: "grid", gap: "14px" }}>
            {managers.map((m) => {
              const isSuperAdmin = m.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
              const isPasswordVisible = !!visiblePasswords[m.email];
              const restName =
                !m.restaurant_id || m.restaurant_id === "all"
                  ? "All Restaurants (Studio Admin)"
                  : restaurants.find((r) => r.id === m.restaurant_id)?.name || m.restaurant_id;

              return (
                <div
                  key={m.email}
                  style={{
                    background: "#fff",
                    border: isSuperAdmin ? "2px solid #88a955" : "1px solid var(--line)",
                    borderRadius: "12px",
                    padding: "18px 20px",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                  }}
                >
                  <div style={{ flex: "1 1 280px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "1rem" }}>{m.name || "Manager"}</strong>
                      {isSuperAdmin && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "12px",
                            background: "#dcfce7",
                            color: "#166534",
                          }}
                        >
                          Super Admin Owner
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "#526348",
                          background: "#f0f5ea",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Store size={12} /> {restName}
                      </span>
                    </div>

                    <p style={{ margin: "6px 0 0", fontSize: "0.875rem", color: "#374151" }}>
                      Gmail: <strong>{m.email}</strong>
                    </p>

                    {m.password && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", fontSize: "0.82rem" }}>
                        <span className="muted">Password:</span>
                        <code
                          style={{
                            background: "#f3f4f6",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontFamily: "monospace",
                            fontSize: "0.85rem",
                          }}
                        >
                          {isPasswordVisible ? m.password : "••••••••"}
                        </code>
                        <button
                          type="button"
                          className="quiet-link"
                          onClick={() =>
                            setVisiblePasswords((prev) => ({
                              ...prev,
                              [m.email]: !prev[m.email],
                            }))
                          }
                          style={{ fontSize: "0.75rem", padding: "2px 4px" }}
                        >
                          {isPasswordVisible ? "Hide" : "Show"}
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => copyCredentials(m)}
                      style={{ fontSize: "0.8rem", padding: "8px 12px" }}
                      title="Copy complete sign-in credentials to share with manager"
                    >
                      {copiedKey === m.email ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                      {copiedKey === m.email ? "Copied!" : "Copy Manager Login"}
                    </button>

                    {!isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => handleRemove(m.email)}
                        disabled={busy}
                        style={{
                          background: "#fee2e2",
                          color: "#991b1b",
                          border: "1px solid #fecaca",
                          fontSize: "0.8rem",
                          padding: "8px 12px",
                          borderRadius: "6px",
                        }}
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

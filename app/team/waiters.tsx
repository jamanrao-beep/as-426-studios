"use client";

import { useEffect, useState } from "react";
import { shortLogin } from "@/lib/login-id";
import { Plus, Copy, Users, Key, Trash2, Store } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface WaiterAccount {
  id: string;
  email: string;
  name: string;
  restaurant_id: string;
  status: "active" | "suspended";
  must_change_password: number;
  session_version: number;
  created_at: string;
}

export default function Waiters({
  restaurant,
  restaurants = [],
  isSuperAdmin = false,
}: {
  restaurant?: string;
  restaurants?: Array<{ id: string; name: string }>;
  isSuperAdmin?: boolean;
}) {
  const [waiters, setWaiters] = useState<WaiterAccount[]>([]);
  const [selectedRest, setSelectedRest] = useState<string>(restaurant || "");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Form states
  const [name, setName] = useState("");
  // A waiter signs in as username@restaurant-code. The username only has to be free at this restaurant.
  const [username, setUsername] = useState("");
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tempPass, setTempPass] = useState("");

  // Credentials copy modal
  const [credentialModal, setCredentialModal] = useState<{
    open: boolean;
    email: string;
    code: string;
    temporaryPassword: string;
    restaurantName: string;
  }>({
    open: false,
    email: "",
    code: "",
    temporaryPassword: "",
    restaurantName: "",
  });

  const codeNow = selectedRest || restaurant || "";
  useEffect(() => {
    const u = username.trim().toLowerCase();
    if (!u || !codeNow) return setNameMsg(null);
    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(u)) return setNameMsg({ ok: false, text: "Use 3 to 30 letters, numbers, dots or dashes." });
    setNameMsg({ ok: true, text: "Checking…" });
    const t = setTimeout(() => {
      fetch(`/api/usernames/check?username=${encodeURIComponent(u)}&restaurant=${encodeURIComponent(codeNow)}`, { cache: "no-store" })
        .then((r) => r.json() as Promise<{ available?: boolean; reason?: string }>)
        .then((d) => setNameMsg(d.available ? { ok: true, text: `${u} is free at this restaurant ✓` } : d.reason ? { ok: false, text: d.reason } : null))
        .catch(() => setNameMsg(null));
    }, 450);
    return () => clearTimeout(t);
  }, [username, codeNow]);

  async function load() {
    setLoading(true);
    try {
      const url = selectedRest
        ? `/api/waiters?restaurant=${encodeURIComponent(selectedRest)}`
        : "/api/waiters";
      const res = await fetch(url);
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to load waiters");
      setWaiters(data.waiters || []);
    } catch (err: any) {
      toast.error(err.message || "Could not load waiters");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [selectedRest]);

  function generatePass() {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let p = "";
    for (let i = 0; i < 8; i++) {
      p += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTempPass(p);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const effectiveRest = selectedRest || restaurant;
    if (!effectiveRest) {
      toast.error("Please select a restaurant for this waiter.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/waiters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          restaurant: effectiveRest,
          name: name.trim(),
          username: username.trim().toLowerCase(),
          temporary_password: tempPass.trim() || undefined,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to create waiter");

      const restObj = restaurants.find((r) => r.id === effectiveRest);
      setCredentialModal({
        open: true,
        email: data.waiter?.email || "",
        code: data.waiter?.restaurant_code || effectiveRest,
        temporaryPassword: data.waiter?.temporary_password || data.temporary_password,
        restaurantName: restObj?.name || effectiveRest,
      });

      setName("");
      setUsername("");
      setNameMsg(null);
      setTempPass("");
      await load();
      toast.success("Waiter account created successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to create waiter");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleStatus(w: WaiterAccount) {
    const nextStatus = w.status === "active" ? "suspended" : "active";
    setBusy(true);
    try {
      const res = await fetch("/api/waiters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_status",
          restaurant: w.restaurant_id,
          email: w.email,
          status: nextStatus,
        }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to toggle status");
      toast.success(`Waiter marked as ${nextStatus}`);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to change status");
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(w: WaiterAccount) {
    if (!confirm(`Generate a new temporary password for ${w.name} (${shortLogin(w.email)})? This will immediately revoke their existing active sessions.`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/waiters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_password",
          restaurant: w.restaurant_id,
          email: w.email,
        }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to reset password");

      const restObj = restaurants.find((r) => r.id === w.restaurant_id);
      setCredentialModal({
        open: true,
        email: w.email,
        code: w.restaurant_id,
        temporaryPassword: data.temporary_password,
        restaurantName: restObj?.name || w.restaurant_id,
      });
      await load();
      toast.success("New temporary password generated.");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(w: WaiterAccount) {
    if (!confirm(`Permanently remove waiter access for ${w.name}? Historical orders they served will be safely preserved.`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/waiters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          restaurant: w.restaurant_id,
          email: w.email,
        }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to remove waiter");
      toast.success("Waiter access removed.");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove waiter");
    } finally {
      setBusy(false);
    }
  }

  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/login` : "";

  function copyCredentialText() {
    const text = `🍽️ Staff Login Details\nRestaurant: ${credentialModal.restaurantName}\nRole: Waiter\nRestaurant code: ${credentialModal.code}\nUsername: ${credentialModal.email.split("@")[0]}\nLogin ID: ${shortLogin(credentialModal.email)}\nTemporary Password: ${credentialModal.temporaryPassword}\nLogin URL: ${loginUrl}\n\n*Note: You will be required to create a new password on your first sign-in.`;
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Credentials copied to clipboard! Share manually with waiter."))
      .catch(() => toast.error("Could not copy to clipboard."));
  }

  return (
    <div className="form-panel" style={{ maxWidth: 880 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <span className="access-badge">
            <Users size={16} /> WAITER ACCOUNTS (ORDERS & DELIVERIES ONLY)
          </span>
          <h2 style={{ marginTop: 8 }}>Manage Waiters</h2>
          <p className="muted" style={{ fontSize: "0.9rem" }}>
            Waiters can view today's orders and notifications, view table numbers, and confirm deliveries. Waiters cannot accept or cancel orders, edit the menu, view sales, or access other restaurants.
          </p>
        </div>

        {isSuperAdmin && restaurants.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Store size={16} className="muted" />
            <select
              value={selectedRest}
              onChange={(e) => setSelectedRest(e.target.value)}
              style={{
                background: "#2a1d18",
                color: "#f1e9e6",
                border: "1px solid #423028",
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: "0.85rem",
              }}
            >
              <option value="">All Restaurants</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Account creation form */}
      <form
        onSubmit={handleCreate}
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12,
          padding: 16,
          marginTop: 20,
        }}
      >
        <h3 style={{ fontSize: "1rem", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={16} /> Create Waiter Account
        </h3>

        {isSuperAdmin && !selectedRest && (
          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ fontSize: "0.85rem", color: "#bda69c" }}>Assign Restaurant *</span>
            <select
              required
              value={selectedRest}
              onChange={(e) => setSelectedRest(e.target.value)}
              style={{
                width: "100%",
                background: "#1d1410",
                color: "#f1e9e6",
                border: "1px solid #3e2c24",
                padding: "8px 12px",
                borderRadius: 8,
                marginTop: 4,
              }}
            >
              <option value="">-- Choose a restaurant --</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            <span style={{ fontSize: "0.85rem", color: "#bda69c" }}>Full Name *</span>
            <input
              required
              maxLength={80}
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
          <label>
            <span style={{ fontSize: "0.85rem", color: "#bda69c" }}>Username *</span>
            <input
              required
              maxLength={30}
              value={username}
              disabled={busy}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
              placeholder="e.g. rahul"
              autoCapitalize="none"
              style={{ width: "100%", marginTop: 4 }}
            />
            <small style={{ color: nameMsg ? (nameMsg.ok ? "#6ee7b7" : "#fca5a5") : "#bda69c", fontWeight: nameMsg ? 700 : 400 }}>
              {nameMsg ? nameMsg.text : `Signs in as ${username || "username"}@${codeNow || "restaurant-code"}`}
            </small>
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: "0.85rem", color: "#bda69c" }}>Temporary Website Password</span>
            <button
              type="button"
              onClick={generatePass}
              style={{
                background: "transparent",
                border: "none",
                color: "#6ee7b7",
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              Generate Random
            </button>
          </div>
          <input
            value={tempPass}
            disabled={busy}
            onChange={(e) => setTempPass(e.target.value)}
            placeholder="Leave empty to auto-generate a secure temporary password"
            style={{ width: "100%" }}
          />
          <small className="muted" style={{ fontSize: "0.75rem", display: "block", marginTop: 4 }}>
            The waiter must change this temporary password upon their first sign-in. Once changed, supervisors cannot view the user's password.
          </small>
        </div>

        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="primary" type="submit" disabled={busy}>
            <Plus size={16} /> {busy ? "Creating..." : "Create Waiter Account"}
          </button>
        </div>
      </form>

      {/* Waiters List */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: "1rem", marginBottom: 12 }}>
          Staff Accounts ({waiters.length})
        </h3>

        {loading ? (
          <p className="muted">Loading staff...</p>
        ) : waiters.length === 0 ? (
          <div className="empty" style={{ padding: 24, textAlign: "center" }}>
            <p className="muted">No waiters created yet for this restaurant.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {waiters.map((w) => {
              const restObj = restaurants.find((r) => r.id === w.restaurant_id);
              return (
                <div
                  key={w.id || w.email}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 10,
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ fontSize: "0.95rem" }}>{w.name}</strong>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          padding: "2px 8px",
                          borderRadius: 12,
                          background: w.status === "active" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                          color: w.status === "active" ? "#6ee7b7" : "#fca5a5",
                          border: `1px solid ${w.status === "active" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                        }}
                      >
                        {w.status.toUpperCase()}
                      </span>
                      {w.must_change_password === 1 && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: "rgba(245,158,11,0.15)",
                            color: "#fcd34d",
                            border: "1px solid rgba(245,158,11,0.3)",
                          }}
                        >
                          PENDING PASSWORD CHANGE
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: "0.82rem", color: "#ac8e81" }}>
                      <span>{shortLogin(w.email)}</span>
                      {isSuperAdmin && restObj && (
                        <span>
                          📍 <strong>{restObj.name}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      className="secondary"
                      style={{ fontSize: "0.78rem", padding: "6px 10px" }}
                      title="Issue new temporary password"
                      onClick={() => handleResetPassword(w)}
                      disabled={busy}
                    >
                      <Key size={13} style={{ marginRight: 4 }} /> Reset Temp Password
                    </button>

                    <button
                      className="secondary status-toggle-btn"
                      style={{
                        fontSize: "0.78rem",
                        padding: "6px 10px",
                        minWidth: 84,
                        textAlign: "center",
                        justifyContent: "center",
                        color: w.status === "active" ? "#fca5a5" : "#6ee7b7",
                      }}
                      onClick={() => handleToggleStatus(w)}
                      disabled={busy}
                    >
                      {w.status === "active" ? "Suspend" : "Reactivate"}
                    </button>

                    <button
                      className="danger"
                      style={{ fontSize: "0.78rem", padding: "6px 10px" }}
                      title="Remove access"
                      onClick={() => handleRemove(w)}
                      disabled={busy}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Shareable Credentials Dialog */}
      <Dialog
        open={credentialModal.open}
        onOpenChange={(v) => setCredentialModal((prev) => ({ ...prev, open: v }))}
      >
        <DialogContent className="editor-modal" style={{ maxWidth: 500 }}>
          <DialogTitle>Temporary Credentials Generated</DialogTitle>
          <DialogDescription>
            Share these details manually with the waiter. The waiter will be required to change their temporary password upon login.
          </DialogDescription>

          <div
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid #423028",
              borderRadius: 8,
              padding: 14,
              marginTop: 12,
              fontFamily: "monospace",
              fontSize: "0.88rem",
              lineHeight: 1.6,
            }}
          >
            <div>
              <strong>Restaurant:</strong> {credentialModal.restaurantName}
            </div>
            <div>
              <strong>Restaurant code:</strong> {credentialModal.code}
            </div>
            <div>
              <strong>Username:</strong> {credentialModal.email.split("@")[0]}
            </div>
            <div>
              <strong>Login ID:</strong> {shortLogin(credentialModal.email)}
            </div>
            <div>
              <strong>Temporary Password:</strong>{" "}
              <span style={{ color: "#6ee7b7", fontWeight: "bold" }}>
                {credentialModal.temporaryPassword}
              </span>
            </div>
            <div>
              <strong>Login URL:</strong> {loginUrl}
            </div>
          </div>

          <p className="muted" style={{ fontSize: "0.78rem", marginTop: 10 }}>
            * For security, passwords are never emailed automatically. Once the waiter sets their private password, supervisors cannot view it.
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <button className="primary" onClick={copyCredentialText}>
              <Copy size={15} style={{ marginRight: 6 }} /> Copy Login Details
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

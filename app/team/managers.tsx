"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Plus,
  Trash2,
  Key,
  Copy,
  Store,
  RefreshCw,
  LogOut,
  Edit2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SUPER_ADMIN_EMAIL } from "@/lib/auth-constants";

interface ManagerAccount {
  id: string;
  email: string;
  role: string;
  name: string;
  restaurant_id: string | null;
  status: "active" | "suspended";
  must_change_password: number;
  session_version: number;
  created_at: string;
}

export default function Managers({
  restaurants,
  onToggleQrVisibility,
}: {
  restaurants: Array<{ id: string; name: string; manager_qr_visible?: boolean }>;
  onToggleQrVisibility?: (restaurantId: string, visible: boolean) => void;
}) {
  const [managers, setManagers] = useState<ManagerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [restaurantId, setRestaurantId] = useState("");

  // Edit / Reassign states
  const [editAccount, setEditAccount] = useState<ManagerAccount | null>(null);
  const [editName, setEditName] = useState("");
  const [reassignAccount, setReassignAccount] = useState<ManagerAccount | null>(null);
  const [reassignRestaurantId, setReassignRestaurantId] = useState("");

  // Credential Modal
  const [credentialModal, setCredentialModal] = useState<{
    open: boolean;
    email: string;
    temporaryPassword: string;
    restaurantName: string;
  }>({
    open: false,
    email: "",
    temporaryPassword: "",
    restaurantName: "",
  });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/managers");
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to load restaurant admin accounts");
      setManagers(data.managers || []);
    } catch (err: any) {
      toast.error(err.message || "Could not load managers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (restaurants.length > 0 && !restaurantId) {
      setRestaurantId(restaurants[0].id);
    }
  }, [restaurants]);

  function generatePassword() {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let pass = "";
    for (let i = 0; i < 9; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
    toast.info("Generated new temporary password");
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please provide a valid email/Gmail address");
      return;
    }
    if (!restaurantId) {
      toast.error("Please assign a restaurant to this Admin account");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          email: email.trim(),
          temporary_password: password.trim() || undefined,
          name: name.trim() || "Restaurant Manager",
          restaurant_id: restaurantId,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to create restaurant admin account");

      const restObj = restaurants.find((r) => r.id === restaurantId);
      setCredentialModal({
        open: true,
        email: data.email,
        temporaryPassword: data.temporary_password,
        restaurantName: restObj?.name || restaurantId,
      });

      setEmail("");
      setPassword("");
      setName("");
      await load();
      toast.success(`Admin account created for ${data.email}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create admin account");
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(m: ManagerAccount) {
    if (
      !confirm(
        `Issue a new temporary password for ${m.name} (${m.email})? This requires another password change and immediately invalidates all their existing sessions.`
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_password",
          email: m.email,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to reset password");

      const restObj = restaurants.find((r) => r.id === m.restaurant_id);
      setCredentialModal({
        open: true,
        email: m.email,
        temporaryPassword: data.temporary_password,
        restaurantName: restObj?.name || m.restaurant_id || "Assigned Restaurant",
      });

      await load();
      toast.success("New temporary password issued and sessions revoked.");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeSessions(m: ManagerAccount) {
    if (!confirm(`Revoke all active sign-in sessions for ${m.name}? They will be forced to log in again.`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revoke_sessions",
          email: m.email,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to revoke sessions");

      toast.success("All active sessions revoked for this account.");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke sessions");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleStatus(m: ManagerAccount) {
    const nextStatus = m.status === "active" ? "suspended" : "active";
    setBusy(true);
    try {
      const res = await fetch("/api/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_status",
          email: m.email,
          status: nextStatus,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to change status");

      toast.success(`Account marked as ${nextStatus}`);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setBusy(false);
    }
  }

  async function handleReassignSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reassignAccount || !reassignRestaurantId) return;

    setBusy(true);
    try {
      const res = await fetch("/api/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reassign",
          email: reassignAccount.email,
          restaurant_id: reassignRestaurantId,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to reassign restaurant");

      toast.success("Admin assigned to new restaurant. Previous sessions revoked.");
      setReassignAccount(null);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to reassign restaurant");
    } finally {
      setBusy(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editAccount) return;

    setBusy(true);
    try {
      const res = await fetch("/api/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          email: editAccount.email,
          name: editName.trim(),
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to update profile");

      toast.success("Admin profile updated.");
      setEditAccount(null);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(targetEmail: string) {
    if (targetEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      toast.error("Super Admin account cannot be removed.");
      return;
    }

    if (!confirm(`Permanently remove restaurant admin access for ${targetEmail}? Historical orders and actions remain intact.`)) {
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

      toast.success("Admin access removed");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove manager");
    } finally {
      setBusy(false);
    }
  }

  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/login` : "";

  function copyCredentialText() {
    const text = `👔 Restaurant Admin Login Details\nRestaurant: ${credentialModal.restaurantName}\nRole: Restaurant Admin / Manager\nEmail: ${credentialModal.email}\nTemporary Password: ${credentialModal.temporaryPassword}\nLogin URL: ${loginUrl}\n\n*Important: You must create a new private password when logging in for the first time.`;
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Login details copied to clipboard!"))
      .catch(() => toast.error("Could not copy to clipboard."));
  }

  return (
    <section className="form-panel" style={{ maxWidth: 880 }}>
      <span className="access-badge" style={{ background: "#e0f2fe", color: "#0369a1" }}>
        <ShieldCheck size={18} /> SUPER ADMIN · RESTAURANT ADMIN MANAGEMENT
      </span>
      <h2>Restaurant Admin Accounts</h2>
      <p className="muted" style={{ fontSize: "0.9rem" }}>
        Create and manage Restaurant Admin accounts. Each Admin is assigned to one restaurant and can only manage menus, orders, customer reviews, and waiters for that restaurant.
      </p>

      {/* Account Creation Form */}
      <form
        onSubmit={handleAdd}
        style={{
          marginTop: 20,
          background: "rgba(255,255,255,0.02)",
          padding: 16,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <h3 style={{ fontSize: "1rem", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={16} /> Create Restaurant Admin Account
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            <span style={{ fontSize: "0.85rem", color: "#a5b4a9" }}>Admin Name *</span>
            <input
              required
              maxLength={80}
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vikram Malhotra"
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
          <label>
            <span style={{ fontSize: "0.85rem", color: "#a5b4a9" }}>Email / Gmail Address *</span>
            <input
              required
              type="email"
              maxLength={254}
              value={email}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="manager@restaurant.com"
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <label>
            <span style={{ fontSize: "0.85rem", color: "#a5b4a9" }}>Assign Restaurant *</span>
            <select
              required
              value={restaurantId}
              onChange={(e) => setRestaurantId(e.target.value)}
              disabled={busy}
              style={{
                width: "100%",
                background: "#131a15",
                color: "#e8efe9",
                border: "1px solid #2a382f",
                padding: "8px 12px",
                borderRadius: 8,
                marginTop: 4,
              }}
            >
              <option value="">-- Choose restaurant --</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", color: "#a5b4a9" }}>Temporary Website Password</span>
              <button
                type="button"
                onClick={generatePassword}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#6ee7b7",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                Auto Generate
              </button>
            </div>
            <input
              value={password}
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave empty to auto-generate"
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
        </div>

        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button className="primary" type="submit" disabled={busy || !email.trim() || !restaurantId}>
            <Plus size={16} /> {busy ? "Creating..." : "Create Admin Account"}
          </button>
        </div>
      </form>

      {/* Admins List */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: "1rem", marginBottom: 12 }}>
          Admin & Manager Accounts ({managers.length})
        </h3>

        {loading ? (
          <p className="muted">Loading accounts...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {managers.map((m) => {
              const isSuper = m.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
              const restObj = restaurants.find((r) => r.id === m.restaurant_id);

              return (
                <div
                  key={m.id || m.email}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                    borderRadius: 10,
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>{m.name || m.email}</strong>

                      {isSuper ? (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: "#0284c7",
                            color: "#ffffff",
                            fontWeight: 600,
                          }}
                        >
                          SUPER ADMIN
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: m.status === "active" ? "#d1fae5" : "#fee2e2",
                            color: m.status === "active" ? "#065f46" : "#991b1b",
                            border: `1px solid ${m.status === "active" ? "#a7f3d0" : "#fecaca"}`,
                            fontWeight: 600,
                          }}
                        >
                          {m.status.toUpperCase()}
                        </span>
                      )}

                      {!isSuper && m.must_change_password === 1 && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: "#fef3c7",
                            color: "#92400e",
                            border: "1px solid #fde68a",
                            fontWeight: 600,
                          }}
                        >
                          TEMP PASSWORD (UNSET)
                        </span>
                      )}
                      {!isSuper && m.must_change_password === 0 && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: "#f1f5f9",
                            color: "#475569",
                            fontWeight: 500,
                          }}
                        >
                          PRIVATE PASSWORD SET
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 14, marginTop: 4, fontSize: "0.82rem", color: "#475569", flexWrap: "wrap", alignItems: "center" }}>
                      <span>{m.email}</span>
                      {!isSuper && (
                        <span>
                          📍 Assigned: <strong style={{ color: "#0f172a" }}>{restObj?.name || m.restaurant_id || "Unassigned"}</strong>
                        </span>
                      )}
                      {!isSuper && restObj && m.restaurant_id && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span>🔲 QR Visibility:</span>
                          <button
                            type="button"
                            onClick={() => {
                              const cur = restObj.manager_qr_visible !== false;
                              if (onToggleQrVisibility && m.restaurant_id) {
                                onToggleQrVisibility(m.restaurant_id, !cur);
                              }
                            }}
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 8,
                              cursor: "pointer",
                              border: restObj.manager_qr_visible !== false ? "1px solid #bbf7d0" : "1px solid #fecaca",
                              background: restObj.manager_qr_visible !== false ? "#dcfce7" : "#fee2e2",
                              color: restObj.manager_qr_visible !== false ? "#166534" : "#991b1b",
                            }}
                            title={`Click to turn ${restObj.manager_qr_visible !== false ? "OFF" : "ON"} QR visibility for ${restObj.name}`}
                          >
                            {restObj.manager_qr_visible !== false ? "ON" : "OFF"}
                          </button>
                        </span>
                      )}
                    </div>
                  </div>

                  {!isSuper && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <button
                        className="secondary"
                        style={{ fontSize: "0.76rem", padding: "5px 9px" }}
                        title="Edit name"
                        onClick={() => {
                          setEditAccount(m);
                          setEditName(m.name || "");
                        }}
                        disabled={busy}
                      >
                        <Edit2 size={12} style={{ marginRight: 3 }} /> Edit
                      </button>

                      <button
                        className="secondary"
                        style={{ fontSize: "0.76rem", padding: "5px 9px" }}
                        title="Reassign to another restaurant"
                        onClick={() => {
                          setReassignAccount(m);
                          setReassignRestaurantId(m.restaurant_id || "");
                        }}
                        disabled={busy}
                      >
                        <Store size={12} style={{ marginRight: 3 }} /> Reassign
                      </button>

                      <button
                        className="secondary"
                        style={{ fontSize: "0.76rem", padding: "5px 9px" }}
                        title="Issue new temporary password"
                        onClick={() => handleResetPassword(m)}
                        disabled={busy}
                      >
                        <Key size={12} style={{ marginRight: 3 }} /> Reset Temp Pass
                      </button>

                      <button
                        className="secondary"
                        style={{ fontSize: "0.76rem", padding: "5px 9px" }}
                        title="Invalidate all active browser sessions"
                        onClick={() => handleRevokeSessions(m)}
                        disabled={busy}
                      >
                        <LogOut size={12} style={{ marginRight: 3 }} /> Revoke
                      </button>

                      <button
                        className="secondary"
                        style={{
                          fontSize: "0.76rem",
                          padding: "5px 9px",
                          color: m.status === "active" ? "#fca5a5" : "#6ee7b7",
                        }}
                        onClick={() => handleToggleStatus(m)}
                        disabled={busy}
                      >
                        {m.status === "active" ? "Suspend" : "Reactivate"}
                      </button>

                      <button
                        className="danger"
                        style={{ fontSize: "0.76rem", padding: "5px 9px" }}
                        title="Remove admin account"
                        onClick={() => handleRemove(m.email)}
                        disabled={busy}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
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
          <DialogTitle>Admin Credentials Generated</DialogTitle>
          <DialogDescription>
            Copy and manually share these credentials with the Restaurant Admin.
          </DialogDescription>

          <div
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid #2e3c33",
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
              <strong>Email:</strong> {credentialModal.email}
            </div>
            <div>
              <strong>Temporary Password:</strong>{" "}
              <span style={{ color: "#6ee7b7", fontWeight: "bold" }}>
                {credentialModal.temporaryPassword}
              </span>
            </div>
            <div>
              <strong>Sign In URL:</strong> {loginUrl}
            </div>
          </div>

          <p className="muted" style={{ fontSize: "0.78rem", marginTop: 10 }}>
            * Password changes are required upon first sign-in. Once changed, supervisors cannot view the user's password.
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <button className="primary" onClick={copyCredentialText}>
              <Copy size={15} style={{ marginRight: 6 }} /> Copy Login Details
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog open={!!editAccount} onOpenChange={(v) => !v && setEditAccount(null)}>
        <DialogContent className="editor-modal" style={{ maxWidth: 450 }}>
          <DialogTitle>Edit Admin Profile</DialogTitle>
          <DialogDescription>Update profile details for {editAccount?.email}</DialogDescription>
          <form onSubmit={handleEditSubmit} style={{ marginTop: 12 }}>
            <label>
              <span style={{ fontSize: "0.85rem" }}>Admin Name</span>
              <input
                required
                maxLength={80}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ width: "100%", marginTop: 4 }}
              />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button type="button" className="secondary" onClick={() => setEditAccount(null)}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={busy}>
                Save Changes
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reassign Restaurant Dialog */}
      <Dialog open={!!reassignAccount} onOpenChange={(v) => !v && setReassignAccount(null)}>
        <DialogContent className="editor-modal" style={{ maxWidth: 450 }}>
          <DialogTitle>Reassign Restaurant</DialogTitle>
          <DialogDescription>
            Reassigning {reassignAccount?.name} ({reassignAccount?.email}) to another restaurant will immediately revoke all their active sessions.
          </DialogDescription>
          <form onSubmit={handleReassignSubmit} style={{ marginTop: 12 }}>
            <label>
              <span style={{ fontSize: "0.85rem" }}>Select New Restaurant *</span>
              <select
                required
                value={reassignRestaurantId}
                onChange={(e) => setReassignRestaurantId(e.target.value)}
                style={{
                  width: "100%",
                  background: "#131a15",
                  color: "#e8efe9",
                  border: "1px solid #2a382f",
                  padding: "8px 12px",
                  borderRadius: 8,
                  marginTop: 4,
                }}
              >
                <option value="">-- Choose restaurant --</option>
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button type="button" className="secondary" onClick={() => setReassignAccount(null)}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={busy || !reassignRestaurantId}>
                Confirm Reassignment
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Utensils,
  LockKeyhole,
  ExternalLink,
  Check,
  Settings2,
  QrCode,
  Users,
  Save,
  Pencil,
  Store,
  Trash2,
  MessageSquare,
  ShoppingBag,
  LogOut,
  ShieldCheck,
  LayoutDashboard,
  Copy,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Toaster, toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sidebar, SidebarProvider } from "@/components/ui/sidebar";
import Sales from "./sales";
import Orders from "./orders";
import OrderAlerts from "./order-alerts";
import Waiters from "./waiters";
import Reviews from "./reviews";
import RestaurantAccess from "./restaurant-access";
import Managers from "./managers";
import SuperAdminOverview from "./super-admin-overview";
import DishPerformance from "./dish-performance";
import DishInsights from "./dish-insights";
import QRCode from "qrcode";
import type { Dish, Menu } from "@/lib/menu";

interface Restaurant {
  id: string;
  name: string;
  active: boolean;
  count: number;
  address?: string;
  contact_phone?: string;
  contact_email?: string;
  welcome_message?: string;
  note?: string;
  status?: string;
  manager_qr_visible?: boolean;
}

const blankDish: Dish = {
  id: "",
  name: "",
  description: "",
  price: 0,
  category: "Small plates",
  veg: true,
  available: true,
  secret: false,
  allergens: "",
  spice: "mild",
  taste: "savoury",
};

export default function Team({
  owner,
  studio,
  email,
  assignedRestaurant,
  userRole = "admin",
}: {
  owner: boolean;
  studio: boolean;
  email: string;
  assignedRestaurant?: string | null;
  userRole?: string;
}) {
  const isSuperAdmin = owner || userRole === "super_admin";
  const isRestaurantAdmin = !isSuperAdmin && userRole === "admin";

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [id, setId] = useState<string>("");
  const [menu, setMenu] = useState<Menu | null>(null);
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dish, setDish] = useState<Dish | null>(null);

  // Tab defaults
  const [tab, setTab] = useState<string>(isSuperAdmin ? "overview" : "menu");

  // Create restaurant dialog
  const [create, setCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [slug, setSlug] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newWelcome, setNewWelcome] = useState("");

  // Archive / Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteName, setDeleteName] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Studio team members state
  const [members, setMembers] = useState<{ email: string }[]>([]);
  const [member, setMember] = useState("");

  // QR & Links
  const [qr, setQr] = useState("");
  const [customerUrl, setCustomerUrl] = useState("");
  const [bestSellerDishId, setBestSellerDishId] = useState<string | null>(null);
  const [topRatedDishId, setTopRatedDishId] = useState<string | null>(null);
  const [togglingQr, setTogglingQr] = useState(false);

  async function handleToggleManagerQr(visible: boolean, targetRestaurantId?: string) {
    const targetId = targetRestaurantId || id;
    if (!targetId || !isSuperAdmin) return;
    setTogglingQr(true);
    try {
      const res = await fetch("/api/restaurants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetId,
          manager_qr_visible: visible,
        }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to update QR visibility");

      setRestaurants((prev) =>
        prev.map((r) => (r.id === targetId ? { ...r, manager_qr_visible: visible } : r))
      );
      toast.success(
        visible
          ? "Manager QR visibility is ON. Managers can view and download the QR code."
          : "Manager QR visibility is OFF. The QR code is hidden from managers."
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update QR visibility");
    } finally {
      setTogglingQr(false);
    }
  }

  async function list() {
    try {
      const r = await fetch("/api/restaurants?admin=1");
      const d = (await r.json()) as any;
      if (!r.ok) throw new Error(d.error || "Failed to load restaurants");

      let rows: Restaurant[] = d.restaurants || [];
      // Role scoping: Restaurant admin can ONLY see their assigned restaurant
      if (isRestaurantAdmin && assignedRestaurant) {
        rows = rows.filter((x) => x.id === assignedRestaurant);
      }

      setRestaurants(rows);
      return rows;
    } catch (e: any) {
      setError(e.message || "Failed to load restaurants");
      return [];
    }
  }

  async function load(next: string) {
    if (!next) return;
    setError("");
    setMenu(null);
    try {
      const r = await fetch(`/api/menu?restaurant=${encodeURIComponent(next)}&admin=1`);
      const d = (await r.json()) as any;
      if (!r.ok) throw new Error(d.error || "Failed to load menu");
      setMenu(d.menu);
      setRevision(d.revision);
      setDirty(false);

      // Fetch best seller & top rated badges
      fetch(`/api/dish-performance?restaurant=${encodeURIComponent(next)}&period=this_month`)
        .then((res) => res.json())
        .then((resData: any) => {
          if (resData?.summary) {
            setBestSellerDishId(resData.summary.bestSeller?.winners[0]?.id || null);
            setTopRatedDishId(resData.summary.highestRated?.winners[0]?.id || null);
          }
        })
        .catch(() => {});
    } catch (e: any) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  useEffect(() => {
    list().then((rows) => {
      if (rows.length > 0) {
        if (assignedRestaurant && rows.some((r) => r.id === assignedRestaurant)) {
          setId(assignedRestaurant);
        } else if (!rows.some((r) => r.id === id)) {
          setId(rows[0].id);
        }
      }
    });
  }, [assignedRestaurant]);

  useEffect(() => {
    if (!id) {
      setError("");
      setMenu(null);
      setCustomerUrl("");
      setQr("");
      return;
    }
    load(id);
    const url = `${window.location.origin}/r/${id}`;
    setCustomerUrl(url);
    QRCode.toDataURL(url, {
      width: 600,
      margin: 4,
      color: { dark: "#17211b", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => setQr(""));
  }, [id]);

  useEffect(() => {
    function leave(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);

  function updateMenu(m: Menu) {
    setMenu(m);
    setDirty(true);
  }

  async function save() {
    if (!menu) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, menu, revision }),
      });
      const d = (await r.json()) as any;
      if (!r.ok) throw new Error(d.error);
      setRevision(d.revision);
      setMenu(d.menu);
      setDirty(false);
      toast.success("Menu saved. Customers will see your latest changes.");
      await list();
    } catch (e: any) {
      setError(e instanceof Error ? e.message : "Couldn’t save");
    } finally {
      setBusy(false);
    }
  }

  async function addRestaurant(e: React.FormEvent) {
    e.preventDefault();
    if (dirty) {
      toast.error("Save the current menu before adding a restaurant.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          id: slug.trim(),
          address: newAddress.trim() || undefined,
          contact_phone: newPhone.trim() || undefined,
          contact_email: newEmail.trim() || undefined,
          welcome_message: newWelcome.trim() || undefined,
        }),
      });
      const d = (await r.json()) as any;
      if (!r.ok) throw new Error(d.error || "Failed to create restaurant");

      await list();
      setId(d.id);
      setCreate(false);
      setNewName("");
      setSlug("");
      setNewAddress("");
      setNewPhone("");
      setNewEmail("");
      setNewWelcome("");
      setTab("qr");
      toast.success("Restaurant added! Stable URL & QR generated. Next: create an Admin account.");
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : "Couldn’t add restaurant");
    } finally {
      setBusy(false);
    }
  }

  async function archiveRestaurant() {
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch("/api/restaurants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, confirmation: deleteName }),
      });
      const result = (await response.json()) as any;
      if (!response.ok) throw new Error(result.error || "Couldn’t archive restaurant");

      const remaining = restaurants.filter((r) => r.id !== id);
      setRestaurants(remaining);
      setDirty(false);
      setMenu(null);
      setError("");
      setDeleteOpen(false);
      setId(remaining[0]?.id || "");
      setTab(isSuperAdmin ? "overview" : "menu");
      toast.success("Restaurant archived. Historical sales and orders are safely retained.");
    } catch (e: any) {
      setDeleteError(e instanceof Error ? e.message : "Couldn’t archive restaurant");
    } finally {
      setDeleting(false);
    }
  }

  async function teamLoad() {
    const r = await fetch("/api/team");
    const d = (await r.json()) as any;
    if (!r.ok) throw new Error(d.error);
    setMembers(d.members || []);
  }

  async function teamChange(emailTarget: string, action: string) {
    try {
      const r = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailTarget, action }),
      });
      const d = (await r.json()) as any;
      if (!r.ok) throw new Error(d.error);
      setMember("");
      await teamLoad();
      toast.success(action === "add" ? "Team access added" : "Team access removed");
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : "Couldn’t update team");
    }
  }

  const currentRest = restaurants.find((r) => r.id === id);
  const savedName = currentRest?.name || "";
  const managerCanSeeQr = currentRest ? currentRest.manager_qr_visible !== false : true;

  // Navigation Items
  const nav = isSuperAdmin
    ? [
        { key: "overview", label: "System overview", icon: LayoutDashboard },
        { key: "dish-performance", label: "Dish performance", icon: TrendingUp },
        { key: "dish-insights", label: "Dish insights", icon: Sparkles },
        { key: "managers", label: "Admins & managers", icon: ShieldCheck },
        { key: "waiters", label: "Manage waiters", icon: Users },
        { key: "orders", label: "Orders & alerts", icon: ShoppingBag },
        { key: "menu", label: "Menu manager", icon: Utensils },
        { key: "sales", label: "Monthly sales", icon: ShoppingBag },
        { key: "reviews", label: "Customer reviews", icon: MessageSquare },
        { key: "settings", label: "Restaurant details", icon: Settings2 },
        { key: "qr", label: "QR & customer link", icon: QrCode },
        ...(id ? [{ key: "restaurant-access", label: "Access permissions", icon: Users }] : []),
        { key: "team", label: "Studio team access", icon: Users },
      ]
    : [
        { key: "orders", label: "Orders & alerts", icon: ShoppingBag },
        { key: "menu", label: "Menu manager", icon: Utensils },
        { key: "dish-performance", label: "Dish performance", icon: TrendingUp },
        { key: "dish-insights", label: "Dish insights", icon: Sparkles },
        { key: "waiters", label: "Manage waiters", icon: Users },
        { key: "sales", label: "Monthly sales", icon: ShoppingBag },
        { key: "reviews", label: "Customer reviews", icon: MessageSquare },
        { key: "settings", label: "Restaurant settings", icon: Settings2 },
        ...(managerCanSeeQr ? [{ key: "qr", label: "QR & customer link", icon: QrCode }] : []),
      ];

  return (
    <SidebarProvider className="admin">
      <Toaster richColors />

      {/* Sidebar Navigation */}
      <Sidebar collapsible="none" className="admin-sidebar">
        <a className="brand" href="/">
          <span className="brandmark">
            <Utensils size={20} />
          </span>
          <span>
            AS 426<small>STUDIOS</small>
          </span>
        </a>

        {/* Restaurant List Section */}
        <p className="sidebar-label">
          {isSuperAdmin ? "RESTAURANTS" : "ASSIGNED VENUE"} <span>{restaurants.length}</span>
        </p>

        <div className="restaurant-list">
          {restaurants.map((r) => (
            <button
              className={id === r.id ? "restaurant-option active" : "restaurant-option"}
              key={r.id}
              onClick={() => {
                if (dirty) {
                  toast.error("Save your changes before switching restaurants.");
                  return;
                }
                setId(r.id);
                if (tab === "overview") setTab("menu");
              }}
            >
              <Store size={16} />
              <span>
                {r.name}
                <small>
                  {r.active ? "Live menu" : "Paused"} · {r.count} dishes
                </small>
              </span>
            </button>
          ))}
        </div>

        {isSuperAdmin && (
          <button className="add-restaurant" onClick={() => setCreate(true)}>
            <Plus size={16} /> Add restaurant
          </button>
        )}

        <div className="sidebar-divider" />

        {/* Nav Tabs */}
        {nav.map((n) => (
          <button
            className={tab === n.key ? "nav-item active" : "nav-item"}
            key={n.key}
            onClick={() => {
              setTab(n.key);
              if (n.key === "team") teamLoad().catch((e) => toast.error(e.message));
            }}
          >
            <n.icon size={18} />
            {n.label}
          </button>
        ))}

        {/* Current User Card */}
        <div className="sidebar-account">
          <span className="avatar">
            {isSuperAdmin ? "SA" : "M"}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {isSuperAdmin
              ? "Super Admin"
              : "Restaurant Admin / Manager"}
            <small style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {email}
            </small>
          </div>
          <a
            className="signout-btn"
            href="/api/auth/logout?return_to=/login"
            title="Sign out"
            style={{ padding: "4px 8px" }}
          >
            <LogOut size={13} />
          </a>
        </div>
      </Sidebar>

      {/* Main Workspace Area */}
      <div className="admin-main">
        <header className="admin-top">
          <span>
            Workspace <span className="muted"> / {tab === "overview" ? "System Overview" : menu?.name || savedName || "Restaurant"}</span>
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {id && (
              <a href={"/r/" + id} target="_blank" rel="noreferrer">
                View customer menu <ExternalLink size={15} />
              </a>
            )}
            <a
              className="quiet-link"
              href="/api/auth/logout?return_to=/login"
              style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#6d786f" }}
            >
              <LogOut size={14} /> Sign out
            </a>
          </div>
        </header>

        <main className="admin-content">
          <OrderAlerts
            managerOnly
            onOpen={(next) => {
              if (dirty) {
                toast.error("Save your menu changes before switching to orders.");
                return;
              }
              setId(next);
              setTab("orders");
            }}
          />

          {/* Section Header */}
          {tab !== "overview" && (
            <div className="admin-title">
              <div>
                <p className="eyebrow">AS 426 STUDIOS · RESTAURANT WORKSPACE</p>
                <h1>{nav.find((n) => n.key === tab)?.label}</h1>
                <p>
                  {tab === "orders"
                    ? "Keep every table moving."
                    : tab === "dish-performance"
                    ? "Track sales volume, revenue contribution and guest ratings for every dish."
                    : tab === "dish-insights"
                    ? "Daily automated dish performance summaries and zero-sales alerts."
                    : tab === "waiters"
                    ? "Give your floor team the access they need."
                    : tab === "managers"
                    ? "Create restaurant admin accounts and configure their access."
                    : tab === "menu"
                    ? "A fresh menu, always within reach."
                    : tab === "reviews"
                    ? "Hear from the people at your tables."
                    : tab === "settings"
                    ? "Make this experience their own."
                    : tab === "qr"
                    ? "One scan. Their next favourite dish."
                    : "The right people, behind every menu."}
                </p>
              </div>

              {menu &&
                tab !== "team" &&
                tab !== "restaurant-access" &&
                tab !== "managers" &&
                tab !== "reviews" &&
                tab !== "orders" &&
                tab !== "waiters" &&
                tab !== "sales" &&
                tab !== "dish-performance" &&
                tab !== "dish-insights" &&
                tab !== "overview" && (
                  <button className="primary" onClick={save} disabled={!dirty || busy}>
                    <Save size={16} />
                    {busy ? "Saving…" : dirty ? "Save changes" : "All changes saved"}
                  </button>
                )}
            </div>
          )}

          {error && (
            <div className="error" role="alert">
              {error} {!menu && id && <button onClick={() => load(id)}>Retry</button>}
            </div>
          )}

          {/* SUPER ADMIN OVERVIEW */}
          {isSuperAdmin && tab === "overview" && (
            <SuperAdminOverview
              restaurants={restaurants}
              onNavigate={(t, rId) => {
                setTab(t);
                if (rId) setId(rId);
              }}
              onAddRestaurant={() => setCreate(true)}
            />
          )}

          {/* EMPTY RESTAURANTS STATE */}
          {!id && !error && tab !== "overview" && (
            <div className="empty">
              <h2>No restaurants yet.</h2>
              <p>Add a restaurant to create its menu and QR code.</p>
              {isSuperAdmin && (
                <button className="primary" onClick={() => setCreate(true)}>
                  <Plus size={16} /> Add restaurant
                </button>
              )}
            </div>
          )}

          {/* MENU MANAGER */}
          {menu && tab === "menu" && (
            <>
              <div className="stats">
                <div>
                  <span>On the menu</span>
                  <strong>
                    {menu.dishes.length}
                    <small>dishes</small>
                  </strong>
                </div>
                <div>
                  <span>Ready to serve</span>
                  <strong>
                    {menu.dishes.filter((d) => d.available).length}
                    <small>available</small>
                  </strong>
                </div>
                <div>
                  <span>A little mystery</span>
                  <strong>
                    {menu.dishes.filter((d) => d.secret).length}
                    <small>secret dishes</small>
                  </strong>
                </div>
              </div>

              <div className="list-heading">
                <div>
                  <h2>Your dishes</h2>
                  <p>Changes go live when you save.</p>
                </div>
                <button className="primary" onClick={() => setDish({ ...blankDish, id: crypto.randomUUID() })}>
                  <Plus size={16} /> Add dish
                </button>
              </div>

              <div className="admin-dishes">
                {menu.dishes.map((d) => (
                  <div className="admin-dish" key={d.id}>
                    <span className={d.secret ? "dish-icon secret" : "dish-icon"}>
                      {d.secret ? <LockKeyhole size={20} /> : <Utensils size={20} />}
                    </span>
                    <div className="admin-dish-name">
                      <h3>
                        {d.name} {d.secret && <span className="tiny-badge">SECRET</span>}
                        {bestSellerDishId === d.id && <span className="dish-badge-bestseller">Best Seller</span>}
                        {topRatedDishId === d.id && <span className="dish-badge-toprated">Top Rated</span>}
                      </h3>
                      <p>
                        {d.category} · {d.veg ? "Vegetarian" : "Non-vegetarian"}
                      </p>
                    </div>
                    <strong>₹{d.price}</strong>
                    <label className="availability">
                      <Switch
                        aria-label={`${d.name} available`}
                        checked={d.available}
                        onCheckedChange={(v) =>
                          updateMenu({
                            ...menu,
                            dishes: menu.dishes.map((x) => (x.id === d.id ? { ...x, available: v } : x)),
                          })
                        }
                      />
                      <span>{d.available ? "Available" : "Sold out"}</span>
                    </label>
                    <button className="icon-button" aria-label={`Edit ${d.name}`} onClick={() => setDish({ ...d })}>
                      <Pencil size={17} />
                    </button>
                  </div>
                ))}
              </div>

              {!menu.dishes.length && (
                <div className="empty">
                  <h2>A new menu starts here.</h2>
                  <p>Add the first dish to bring this restaurant to life.</p>
                </div>
              )}

              <div className="tip">
                <LockKeyhole size={22} />
                <div>
                  <strong>Give them something to discover.</strong>
                  <p>Mark a dish as secret to put it behind the customer’s “Unlock the secret” button.</p>
                </div>
              </div>
            </>
          )}

          {/* RESTAURANT SETTINGS & DETAILS */}
          {menu && tab === "settings" && (
            <div className="form-panel">
              <label>
                Restaurant name
                <input value={menu.name} maxLength={70} onChange={(e) => updateMenu({ ...menu, name: e.target.value })} />
              </label>
              <label>
                Welcome line / Tagline
                <input
                  value={menu.tagline}
                  maxLength={120}
                  onChange={(e) => updateMenu({ ...menu, tagline: e.target.value })}
                />
              </label>
              <label>
                Menu note / tax and allergy information
                <textarea
                  value={menu.note}
                  maxLength={200}
                  onChange={(e) => updateMenu({ ...menu, note: e.target.value })}
                />
              </label>

              <label className="switch-label">
                <Switch checked={menu.active} onCheckedChange={(v) => updateMenu({ ...menu, active: v })} />
                Customer ordering {menu.active ? "live (accepting orders)" : "paused"}
              </label>
              <p className="muted">
                Pausing hides ordering while keeping all menu dishes and historic records safe. Customers will see "Menu coming soon" or a paused notice.
              </p>

              <label>
                Permanent menu path
                <input readOnly value={"/r/" + id} />
              </label>

              {/* MANAGER QR VISIBILITY CONTROL (SUPER ADMIN ONLY) */}
              {isSuperAdmin && (
                <div
                  style={{
                    margin: "20px 0",
                    padding: "16px 18px",
                    background: "#f8fafc",
                    border: "1.5px solid #e2e8f0",
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>Manager QR Visibility</strong>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: managerCanSeeQr ? "#dcfce7" : "#fee2e2",
                          color: managerCanSeeQr ? "#166534" : "#991b1b",
                          border: managerCanSeeQr ? "1px solid #bbf7d0" : "1px solid #fecaca",
                        }}
                      >
                        {managerCanSeeQr ? "ON" : "OFF"}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.82rem", color: "#475569", margin: 0 }}>
                      Control whether restaurant managers can view and download this restaurant's QR code.
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: managerCanSeeQr ? "#166534" : "#64748b" }}>
                      {managerCanSeeQr ? "ON" : "OFF"}
                    </span>
                    <Switch
                      checked={managerCanSeeQr}
                      disabled={togglingQr}
                      onCheckedChange={(checked) => handleToggleManagerQr(checked)}
                    />
                  </div>
                </div>
              )}

              {/* ARCHIVE RESTAURANT (SUPER ADMIN ONLY) */}
              {isSuperAdmin && (
                <div className="delete-zone">
                  <h2>Archive Restaurant</h2>
                  <p>
                    Archiving deactivates this restaurant and shows "Restaurant unavailable" to visitors. All historic orders, customer reviews, and sales reports are permanently preserved.
                  </p>
                  <button
                    className="delete-button"
                    disabled={busy}
                    onClick={() => {
                      setDeleteName("");
                      setDeleteError("");
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2 size={16} /> Archive restaurant
                  </button>
                </div>
              )}
            </div>
          )}

          {/* QR & CUSTOMER LINK */}
          {tab === "qr" && !isSuperAdmin && !managerCanSeeQr && (
            <div
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: "48px 24px",
                textAlign: "center",
                maxWidth: 580,
                margin: "24px auto",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: "50%",
                  background: "#fee2e2",
                  color: "#991b1b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px auto",
                }}
              >
                <QrCode size={30} />
              </div>
              <h2 style={{ fontSize: "1.35rem", color: "#0f172a", marginBottom: 8, fontWeight: 700 }}>
                QR Code Access Disabled
              </h2>
              <p style={{ color: "#475569", fontSize: "0.9rem", lineHeight: 1.6, margin: 0 }}>
                The Super Admin has turned off QR code visibility for this restaurant. Please contact your Super Admin if you need access to the table QR code or printable assets.
              </p>
            </div>
          )}

          {tab === "qr" && (isSuperAdmin || managerCanSeeQr) && (
            <div className="qr-panel">
              <div className="qr-card">
                <p className="eyebrow">{menu?.name || savedName}</p>
                <h2>
                  Your table
                  <br />
                  has a secret.
                </h2>
                {qr && <img src={qr} alt={`QR code for ${menu?.name || savedName}'s menu`} />}
                <p>Scan. Discover. Enjoy.</p>
                <small>BY AS 426 STUDIOS</small>
              </div>

              <div>
                <h2>Bring the menu to the table.</h2>
                <p>
                  Place this QR on table cards, bills or takeaway packaging. Each QR code is uniquely bound to this restaurant and never changes when dish names or prices update.
                </p>

                <label>
                  Customer menu link
                  <input readOnly value={customerUrl} />
                </label>

                <div className="button-row">
                  <button
                    className="primary"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(customerUrl)
                        .then(() => toast.success("Link copied"))
                        .catch(() => toast.error("Select and copy the link above."))
                    }
                  >
                    <Copy size={15} style={{ marginRight: 6 }} /> Copy link
                  </button>
                  {qr && (
                    <a className="secondary" href={qr} download={`${id}-qr.png`}>
                      Download QR
                    </a>
                  )}
                </div>

                {/* SUPER ADMIN ON/OFF CONTROL FOR MANAGER QR VISIBILITY */}
                {isSuperAdmin && (
                  <div
                    style={{
                      marginTop: 22,
                      padding: "16px 18px",
                      borderRadius: 12,
                      background: "#f8fafc",
                      border: "1.5px solid #e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>Manager QR Visibility</strong>
                        <span
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            padding: "2px 8px",
                            borderRadius: 10,
                            background: managerCanSeeQr ? "#dcfce7" : "#fee2e2",
                            color: managerCanSeeQr ? "#166534" : "#991b1b",
                            border: managerCanSeeQr ? "1px solid #bbf7d0" : "1px solid #fecaca",
                          }}
                        >
                          {managerCanSeeQr ? "ON" : "OFF"}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.82rem", color: "#475569", margin: 0 }}>
                        {managerCanSeeQr
                          ? "Restaurant Managers can see and download this QR code."
                          : "This QR code is hidden from Restaurant Managers."}
                      </p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: managerCanSeeQr ? "#166534" : "#64748b" }}>
                        {managerCanSeeQr ? "ON" : "OFF"}
                      </span>
                      <Switch
                        checked={managerCanSeeQr}
                        disabled={togglingQr}
                        onCheckedChange={(checked) => handleToggleManagerQr(checked)}
                      />
                    </div>
                  </div>
                )}

                <p className="muted" style={{ marginTop: 18 }}>
                  Private customer order isolation: Customers scan this QR to order from their table without registering or logging in. No staff tokens or passwords are ever placed inside QR codes.
                </p>
              </div>
            </div>
          )}

          {/* SALES REPORT */}
          {id && tab === "sales" && <Sales key={id} restaurant={id} />}

          {/* DISH PERFORMANCE REPORT */}
          {id && tab === "dish-performance" && (
            <DishPerformance
              key={id}
              restaurant={id}
              restaurants={restaurants}
              isSuperAdmin={isSuperAdmin}
              onSelectRestaurant={(nextId) => setId(nextId)}
            />
          )}

          {/* DISH INSIGHTS NOTIFICATIONS */}
          {tab === "dish-insights" && (
            <DishInsights
              key={id}
              restaurant={isSuperAdmin ? "" : id}
              onOpenReport={(rId) => {
                if (rId) setId(rId);
                setTab("dish-performance");
              }}
            />
          )}

          {/* ORDERS & LIVE ALERTS */}
          {id && tab === "orders" && <Orders key={id} restaurant={id} canEdit />}

          {/* WAITERS MANAGEMENT */}
          {tab === "waiters" && (
            <Waiters
              key={id}
              restaurant={id}
              restaurants={restaurants}
              isSuperAdmin={isSuperAdmin}
            />
          )}

          {/* REVIEWS */}
          {id && tab === "reviews" && <Reviews key={id} restaurant={id} />}

          {/* SUPER ADMIN: MANAGERS */}
          {isSuperAdmin && tab === "managers" && (
            <Managers
              key="managers"
              restaurants={restaurants}
              onToggleQrVisibility={(restId, visible) => handleToggleManagerQr(visible, restId)}
            />
          )}

          {/* RESTAURANT ACCESS */}
          {isSuperAdmin && id && tab === "restaurant-access" && (
            <RestaurantAccess key={id} restaurant={id} name={menu?.name || savedName} />
          )}

          {/* STUDIO TEAM ACCESS */}
          {isSuperAdmin && tab === "team" && (
            <div className="form-panel">
              <h2>Manage your studio team</h2>
              <p>
                Studio team members can manage every restaurant and assign restaurant managers. To give access to just one restaurant, select it and choose Restaurant access.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  teamChange(member, "add");
                }}
              >
                <label>
                  Teammate’s sign-in email
                  <input
                    type="email"
                    required
                    value={member}
                    onChange={(e) => setMember(e.target.value)}
                    placeholder="Enter email"
                  />
                </label>
                <button className="primary" type="submit">
                  <Plus size={16} /> Add team member
                </button>
              </form>
              {members.map((m) => (
                <div className="member-row" key={m.email}>
                  <span>{m.email}</span>
                  <button onClick={() => teamChange(m.email, "remove")}>Remove access</button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ARCHIVE RESTAURANT CONFIRMATION DIALOG */}
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(v) => {
          if (!deleting) setDeleteOpen(v);
        }}
      >
        <AlertDialogContent className="editor-modal">
          <AlertDialogTitle>Archive {savedName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This action deactivates the customer menu and displays "Restaurant unavailable" on QR scans. All historical orders, sales data, and customer reviews will be permanently retained. Type the restaurant name below to confirm.
          </AlertDialogDescription>
          <label>
            Type <strong>{savedName}</strong> to confirm
            <input
              autoComplete="off"
              value={deleteName}
              disabled={deleting}
              onChange={(e) => setDeleteName(e.target.value)}
            />
          </label>
          {deleteError && (
            <p className="error" role="alert">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep restaurant</AlertDialogCancel>
            <AlertDialogAction
              className="delete-button"
              disabled={deleting || busy || !savedName || deleteName.trim().toLowerCase() !== savedName.trim().toLowerCase()}
              onClick={(e) => {
                e.preventDefault();
                archiveRestaurant();
              }}
            >
              {deleting ? "Archiving…" : "Archive restaurant"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ADD / EDIT DISH DIALOG */}
      <Dialog open={!!dish} onOpenChange={(v) => !v && setDish(null)}>
        <DialogContent className="editor-modal">
          <DialogTitle>{menu?.dishes.some((d) => d.id === dish?.id) ? "Edit dish" : "Add a dish"}</DialogTitle>
          <DialogDescription>Save the menu after editing to publish your changes.</DialogDescription>
          {dish && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!menu) return;
                updateMenu({
                  ...menu,
                  dishes: menu.dishes.some((d) => d.id === dish.id)
                    ? menu.dishes.map((d) => (d.id === dish.id ? dish : d))
                    : [...menu.dishes, dish],
                });
                setDish(null);
              }}
            >
              <label>
                Dish name
                <input
                  required
                  maxLength={100}
                  value={dish.name}
                  onChange={(e) => setDish({ ...dish, name: e.target.value })}
                />
              </label>
              <label>
                Description
                <textarea
                  maxLength={350}
                  value={dish.description}
                  onChange={(e) => setDish({ ...dish, description: e.target.value })}
                />
              </label>
              <div className="form-row">
                <label>
                  Price (₹)
                  <input
                    type="number"
                    required
                    min="0"
                    max="100000"
                    step="0.01"
                    value={dish.price}
                    onChange={(e) => setDish({ ...dish, price: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Category
                  <input
                    required
                    maxLength={40}
                    list="categories"
                    value={dish.category}
                    onChange={(e) => setDish({ ...dish, category: e.target.value })}
                  />
                  <datalist id="categories">
                    {[...new Set(menu?.dishes.map((d) => d.category))].map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>
              </div>
              <label>
                Allergens
                <input
                  maxLength={150}
                  value={dish.allergens}
                  onChange={(e) => setDish({ ...dish, allergens: e.target.value })}
                  placeholder="e.g. Milk, nuts, wheat"
                />
              </label>
              <div className="taste-fields">
                <fieldset>
                  <legend>Spice level</legend>
                  <RadioGroup
                    value={dish.spice}
                    onValueChange={(v) => setDish({ ...dish, spice: v as Dish["spice"] })}
                    className="radio-options"
                  >
                    {["mild", "medium", "hot"].map((v) => (
                      <label key={v}>
                        <RadioGroupItem value={v} />
                        {v}
                      </label>
                    ))}
                  </RadioGroup>
                </fieldset>
                <fieldset>
                  <legend>Flavour</legend>
                  <RadioGroup
                    value={dish.taste}
                    onValueChange={(v) => setDish({ ...dish, taste: v as Dish["taste"] })}
                    className="radio-options"
                  >
                    {["savoury", "sweet", "refreshing"].map((v) => (
                      <label key={v}>
                        <RadioGroupItem value={v} />
                        {v}
                      </label>
                    ))}
                  </RadioGroup>
                </fieldset>
              </div>
              <div className="toggle-row">
                <label>
                  <Switch checked={dish.veg} onCheckedChange={(v) => setDish({ ...dish, veg: v })} />
                  Vegetarian
                </label>
                <label>
                  <Switch checked={dish.secret} onCheckedChange={(v) => setDish({ ...dish, secret: v })} />
                  Secret dish
                </label>
                <label>
                  <Switch checked={dish.available} onCheckedChange={(v) => setDish({ ...dish, available: v })} />
                  Available
                </label>
              </div>
              <div className="button-row">
                <button className="primary" type="submit">
                  Keep changes
                </button>
                {menu?.dishes.some((d) => d.id === dish.id) && (
                  <button
                    className="danger"
                    type="button"
                    onClick={() => {
                      if (menu) updateMenu({ ...menu, dishes: menu.dishes.filter((d) => d.id !== dish.id) });
                      setDish(null);
                      toast("Dish removed from draft. Save to publish.");
                    }}
                  >
                    Remove from menu
                  </button>
                )}
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ADD RESTAURANT DIALOG */}
      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent className="editor-modal" style={{ maxWidth: 520 }}>
          <DialogTitle>Add a restaurant</DialogTitle>
          <DialogDescription>
            Step 1 & 2: Save restaurant details, assign a unique stable URL, and generate QR code automatically.
          </DialogDescription>
          <form onSubmit={addRestaurant} style={{ marginTop: 12 }}>
            <label>
              <span style={{ fontSize: "0.85rem" }}>Restaurant name *</span>
              <input
                required
                maxLength={70}
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "")
                      .slice(0, 60)
                  );
                }}
                placeholder="e.g. The Green Fork"
              />
            </label>
            <label>
              <span style={{ fontSize: "0.85rem" }}>Unique menu URL slug *</span>
              <input
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={60}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
              <small className="muted" style={{ display: "block", marginTop: 2 }}>
                /r/{slug || "restaurant-name"}
              </small>
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
              <label>
                <span style={{ fontSize: "0.85rem" }}>Contact Phone</span>
                <input
                  maxLength={40}
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+91 98100 12345"
                />
              </label>
              <label>
                <span style={{ fontSize: "0.85rem" }}>Contact Email</span>
                <input
                  type="email"
                  maxLength={100}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="contact@venue.com"
                />
              </label>
            </div>

            <label style={{ marginTop: 8 }}>
              <span style={{ fontSize: "0.85rem" }}>Address</span>
              <input
                maxLength={150}
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="e.g. 12 Connaught Place, New Delhi"
              />
            </label>

            <label style={{ marginTop: 8 }}>
              <span style={{ fontSize: "0.85rem" }}>Welcome line</span>
              <input
                maxLength={120}
                value={newWelcome}
                onChange={(e) => setNewWelcome(e.target.value)}
                placeholder="Welcome to our table."
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button type="button" className="secondary" onClick={() => setCreate(false)}>
                Cancel
              </button>
              <button className="primary" disabled={busy || !newName.trim() || !slug.trim()}>
                {busy ? "Creating…" : "Create Restaurant & QR"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

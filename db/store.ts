import { getAuthUser } from "@/lib/auth";
import { sample } from "@/lib/menu";
import { getSqliteD1 } from "@/db/sqlite";
import { getMysqlDb, isMysqlConfigured } from "@/db/mysql";
import { UserRole } from "@/lib/auth-constants";

export function db(): D1Database {
  const cfDb = (globalThis as any).DB;
  if (cfDb) return cfDb;
  if (isMysqlConfigured()) {
    return getMysqlDb() as unknown as D1Database;
  }
  return getSqliteD1() as unknown as D1Database;
}

export type Access = {
  allowed: boolean;
  owner: boolean; // Super Admin
  studio: boolean; // Super Admin
  role: UserRole | "";
  userId?: string;
  name?: string;
  email: string;
  restaurantId?: string;
  restaurantName?: string;
  restaurantIds: string[];
  mustChangePassword?: boolean;
};

export async function access(restaurantId?: string): Promise<Access> {
  const user = await getAuthUser();
  if (!user) {
    return {
      allowed: false,
      owner: false,
      studio: false,
      role: "",
      email: "",
      restaurantIds: [],
      mustChangePassword: false,
    };
  }

  const isSuperAdmin = user.role === "super_admin";
  const userRestaurantId = user.restaurantId;

  if (isSuperAdmin) {
    // Super Admin has access to all active restaurants
    const allRestaurants = await db()
      .prepare("SELECT id FROM restaurants WHERE status != 'archived'")
      .all<{ id: string }>();
    const ids = allRestaurants.results.map((r) => r.id);
    if (!ids.includes("ember-spice")) ids.unshift("ember-spice");

    let restaurantName = "";
    if (restaurantId) {
      const rest = await db().prepare("SELECT name FROM restaurants WHERE id = ?").bind(restaurantId).first<{ name: string }>();
      restaurantName = rest?.name || restaurantId;
    }

    return {
      allowed: true,
      owner: true,
      studio: true,
      role: "super_admin",
      userId: user.userId,
      name: user.displayName || user.email,
      email: user.email,
      restaurantId: restaurantId || "ember-spice",
      restaurantName,
      restaurantIds: ids,
      mustChangePassword: !!user.mustChangePassword,
    };
  }

  // Restaurant Admin / Manager
  if (user.role === "admin") {
    // Check if assigned restaurant is active
    let restName = userRestaurantId || "";
    if (userRestaurantId) {
      const rest = await db()
        .prepare("SELECT name, status FROM restaurants WHERE id = ?")
        .bind(userRestaurantId)
        .first<{ name: string; status: string }>();
      if (rest && (rest.status === "suspended" || rest.status === "archived")) {
        return {
          allowed: false,
          owner: false,
          studio: false,
          role: "admin",
          userId: user.userId,
          name: user.displayName || user.email,
          email: user.email,
          restaurantId: userRestaurantId,
          restaurantName: rest.name,
          restaurantIds: [],
          mustChangePassword: !!user.mustChangePassword,
        };
      }
      if (rest) restName = rest.name;
    }

    const ids = userRestaurantId ? [userRestaurantId] : [];
    const allowed = restaurantId !== undefined ? userRestaurantId === restaurantId : ids.length > 0;
    return {
      allowed,
      owner: false,
      studio: false,
      role: "admin",
      userId: user.userId,
      name: user.displayName || user.email,
      email: user.email,
      restaurantId: userRestaurantId,
      restaurantName: restName,
      restaurantIds: ids,
      mustChangePassword: !!user.mustChangePassword,
    };
  }

  // Waiter (orders-only)
  const ids = userRestaurantId ? [userRestaurantId] : [];
  let waiterRestName = userRestaurantId || "";
  if (userRestaurantId) {
    const rest = await db().prepare("SELECT name FROM restaurants WHERE id = ?").bind(userRestaurantId).first<{ name: string }>();
    if (rest) waiterRestName = rest.name;
  }

  return {
    allowed: false, // Waiters do not have general manager access
    owner: false,
    studio: false,
    role: "waiter",
    userId: user.userId,
    name: user.displayName || user.email,
    email: user.email,
    restaurantId: userRestaurantId,
    restaurantName: waiterRestName,
    restaurantIds: ids,
    mustChangePassword: !!user.mustChangePassword,
  };
}

export async function orderAccess(restaurantId?: string, managerOnly = false): Promise<Access> {
  const user = await getAuthUser();
  if (!user) {
    return {
      allowed: false,
      owner: false,
      studio: false,
      role: "",
      email: "",
      restaurantIds: [],
      mustChangePassword: false,
    };
  }

  if (user.role === "super_admin") {
    return access(restaurantId);
  }

  // Check restaurant status for staff
  let restaurantName = user.restaurantId || "";
  if (user.restaurantId) {
    const rest = await db()
      .prepare("SELECT name, status FROM restaurants WHERE id = ?")
      .bind(user.restaurantId)
      .first<{ name: string; status: string }>();
    if (rest && (rest.status === "suspended" || rest.status === "archived")) {
      return {
        allowed: false,
        owner: false,
        studio: false,
        role: user.role,
        userId: user.userId,
        name: user.displayName || user.email,
        email: user.email,
        restaurantId: user.restaurantId,
        restaurantName: rest.name,
        restaurantIds: [],
        mustChangePassword: !!user.mustChangePassword,
      };
    }
    if (rest) restaurantName = rest.name;
  }

  if (user.role === "admin") {
    const ids = user.restaurantId ? [user.restaurantId] : [];
    const allowed = restaurantId !== undefined ? user.restaurantId === restaurantId : ids.length > 0;
    return {
      allowed,
      owner: false,
      studio: false,
      role: "admin",
      userId: user.userId,
      name: user.displayName || user.email,
      email: user.email,
      restaurantId: user.restaurantId,
      restaurantName,
      restaurantIds: ids,
      mustChangePassword: !!user.mustChangePassword,
    };
  }

  // Waiter
  if (user.role === "waiter") {
    if (managerOnly) {
      return {
        allowed: false,
        owner: false,
        studio: false,
        role: "waiter",
        userId: user.userId,
        name: user.displayName || user.email,
        email: user.email,
        restaurantId: user.restaurantId,
        restaurantName,
        restaurantIds: [],
        mustChangePassword: !!user.mustChangePassword,
      };
    }

    const ids = user.restaurantId ? [user.restaurantId] : [];
    const allowed = restaurantId !== undefined ? user.restaurantId === restaurantId : ids.length > 0;
    return {
      allowed,
      owner: false,
      studio: false,
      role: "waiter",
      userId: user.userId,
      name: user.displayName || user.email,
      email: user.email,
      restaurantId: user.restaurantId,
      restaurantName,
      restaurantIds: ids,
      mustChangePassword: !!user.mustChangePassword,
    };
  }

  return {
    allowed: false,
    owner: false,
    studio: false,
    role: "",
    userId: user.userId,
    name: user.displayName || user.email,
    email: user.email,
    restaurantIds: [],
    mustChangePassword: false,
  };
}

export async function readMenu(id: string) {
  const row = await db().prepare("SELECT data, revision FROM menu WHERE id = ?").bind(id).first<{ data: string; revision: number }>();
  if (row) {
    const menu = JSON.parse(row.data);
    return menu.deleted ? null : { menu, revision: row.revision };
  }
  return id === "ember-spice" ? { menu: sample, revision: 0 } : null;
}

export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(req.url).origin;
}

export function validSlug(s: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 60;
}

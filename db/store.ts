import { getAuthUser } from "@/lib/auth";
import { sample } from "@/lib/menu";
import { getSqliteD1 } from "@/db/sqlite";
import { UserRole } from "@/lib/auth-constants";

export function db(): D1Database {
  const cfDb = (globalThis as any).DB;
  if (cfDb) return cfDb;
  return getSqliteD1() as unknown as D1Database;
}

export type Access = {
  allowed: boolean;
  owner: boolean; // Super Admin
  studio: boolean; // Super Admin
  role: UserRole | "";
  email: string;
  restaurantId?: string;
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

    return {
      allowed: true,
      owner: true,
      studio: true,
      role: "super_admin",
      email: user.email,
      restaurantIds: ids,
      mustChangePassword: !!user.mustChangePassword,
    };
  }

  // Restaurant Admin / Manager
  if (user.role === "admin") {
    const ids = userRestaurantId ? [userRestaurantId] : [];
    const allowed = restaurantId !== undefined ? userRestaurantId === restaurantId : ids.length > 0;
    return {
      allowed,
      owner: false,
      studio: false,
      role: "admin",
      email: user.email,
      restaurantId: userRestaurantId,
      restaurantIds: ids,
      mustChangePassword: !!user.mustChangePassword,
    };
  }

  // Waiter (orders-only)
  const ids = userRestaurantId ? [userRestaurantId] : [];
  return {
    allowed: false, // Waiters do not have general manager access
    owner: false,
    studio: false,
    role: "waiter",
    email: user.email,
    restaurantId: userRestaurantId,
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

  if (user.role === "admin") {
    const ids = user.restaurantId ? [user.restaurantId] : [];
    const allowed = restaurantId !== undefined ? user.restaurantId === restaurantId : ids.length > 0;
    return {
      allowed,
      owner: false,
      studio: false,
      role: "admin",
      email: user.email,
      restaurantId: user.restaurantId,
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
        email: user.email,
        restaurantId: user.restaurantId,
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
      email: user.email,
      restaurantId: user.restaurantId,
      restaurantIds: ids,
      mustChangePassword: !!user.mustChangePassword,
    };
  }

  return {
    allowed: false,
    owner: false,
    studio: false,
    role: "",
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

export type UserRole = "super_admin" | "admin" | "waiter";
export type AccountStatus = "active" | "suspended";

export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  restaurantId?: string;
  mustChangePassword?: boolean;
  sessionVersion?: number;
}

export interface AccountRecord {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  restaurant_id: string | null;
  status: AccountStatus;
  must_change_password: number; // 1 or 0
  session_version: number;
  created_at: string;
  updated_at: string;
}

export const AUTH_COOKIE_NAME = "as426_session";

export const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "admin@as426.studios";
export const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "admin@009988763366";

/**
 * Default preset accounts used for offline fallback and quick initial testing.
 */
export const PRESET_ACCOUNTS: Array<{
  email: string;
  password: string;
  role: UserRole;
  displayName: string;
  restaurantId?: string;
  description: string;
}> = [
  {
    email: "admin@as426.studios",
    password: "admin@009988763366",
    role: "super_admin",
    displayName: "Super Admin",
    description: "Super Admin Access: Manage all restaurants, create managers, assign restaurants and oversee system.",
  },
  {
    email: "admin@as426.com",
    password: "admin123",
    role: "admin",
    displayName: "Restaurant Manager",
    restaurantId: "ember-spice",
    description: "Restaurant Admin / Manager Access: Manage menu, dishes, daily orders, waiters and customer reviews.",
  },
  {
    email: "staff@as426.com",
    password: "staff123",
    role: "waiter",
    displayName: "Staff Waiter",
    restaurantId: "ember-spice",
    description: "Orders Feed: Live table orders, alerts and delivery confirmation.",
  },
];

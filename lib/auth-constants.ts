export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  role: "admin" | "waiter";
  restaurantId?: string;
}

export const AUTH_COOKIE_NAME = "as426_session";

export const SUPER_ADMIN_EMAIL = "admin@as426.studios";
export const SUPER_ADMIN_PASSWORD = "admin@009988763366";

export const PRESET_ACCOUNTS: Array<{
  email: string;
  password: string;
  role: "admin" | "waiter";
  displayName: string;
  restaurantId?: string;
  description: string;
}> = [
  {
    email: "admin@as426.studios",
    password: "admin@009988763366",
    role: "admin",
    displayName: "Super Admin",
    description: "Full Super Admin Access: Manage restaurants, dishes, managers, daily orders, monthly sales and reviews.",
  },
  {
    email: "admin@as426.com",
    password: "admin123",
    role: "admin",
    displayName: "AS 426 Admin",
    description: "Full Admin Access: Manage restaurants, dishes, waiters, daily orders, monthly sales and reviews.",
  },
  {
    email: "staff@as426.com",
    password: "staff123",
    role: "waiter",
    displayName: "Staff Waiter",
    restaurantId: "ember-spice",
    description: "Common Staff Access: Live table orders, push alerts, customer requests and delivery confirmation.",
  },
];

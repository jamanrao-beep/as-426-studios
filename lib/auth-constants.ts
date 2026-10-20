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

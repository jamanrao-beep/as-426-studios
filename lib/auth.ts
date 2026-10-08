import { cookies } from "next/headers";
import { AuthUser, AUTH_COOKIE_NAME, PRESET_ACCOUNTS } from "./auth-constants";
import { db } from "@/db/store";

export { AUTH_COOKIE_NAME, PRESET_ACCOUNTS, type AuthUser };

export async function authenticate(email: string, pass: string): Promise<AuthUser | null> {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Check SQLite accounts table
  try {
    const row = await db()
      .prepare("SELECT email, password, role, name, restaurant_id FROM accounts WHERE LOWER(email) = ?")
      .bind(normalizedEmail)
      .first<{ email: string; password: string; role: string; name: string; restaurant_id?: string | null }>();

    if (row && row.password === pass) {
      return {
        userId: row.email,
        email: row.email,
        displayName: row.name || (row.role === "admin" ? "Admin / Manager" : "Staff"),
        role: row.role === "admin" ? "admin" : "waiter",
        restaurantId: row.restaurant_id || undefined,
      };
    }
  } catch (err) {
    console.error("Account lookup error:", err);
  }

  // 2. Fallback to preset accounts
  const found = PRESET_ACCOUNTS.find(
    (acc) => acc.email.toLowerCase() === normalizedEmail && acc.password === pass
  );
  if (found) {
    return {
      userId: found.email,
      email: found.email,
      displayName: found.displayName,
      role: found.role,
      restaurantId: found.restaurantId,
    };
  }

  return null;
}

export function encodeSession(user: AuthUser): string {
  const payload = {
    ...user,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeSession(token: string): AuthUser | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.email || typeof parsed.email !== "string") return null;
    if (parsed.exp && parsed.exp < Date.now()) return null;
    return {
      userId: parsed.userId || parsed.email,
      email: parsed.email.toLowerCase(),
      displayName: parsed.displayName || parsed.email,
      role: parsed.role === "admin" ? "admin" : "waiter",
      restaurantId: parsed.restaurantId,
    };
  } catch {
    return null;
  }
}

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return null;
    return decodeSession(token);
  } catch {
    return null;
  }
}

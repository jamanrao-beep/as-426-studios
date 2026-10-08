import { cookies } from "next/headers";
import { AuthUser, AUTH_COOKIE_NAME, PRESET_ACCOUNTS, UserRole } from "./auth-constants";
import { db } from "@/db/store";
import { verifyPassword } from "./password";
import { rateLimit, clearRateLimit } from "./rate-limit";
import crypto from "node:crypto";

export { AUTH_COOKIE_NAME, PRESET_ACCOUNTS, type AuthUser };

const SESSION_SECRET = process.env.SESSION_SECRET || "as426-secure-session-secret-key-32chars";

function signPayload(dataStr: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(dataStr).digest("base64url");
}

/**
 * Authenticate credentials against SQLite accounts table with rate limiting and password verification.
 */
export async function authenticate(
  email: string,
  pass: string,
  clientIp: string = "unknown"
): Promise<{ user: AuthUser | null; error?: string; rateLimited?: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Check rate limit: 6 attempts per 15 minutes
  const limitCheck = rateLimit(`login:${clientIp}:${normalizedEmail}`, 6, 15 * 60 * 1000);
  if (!limitCheck.allowed) {
    return {
      user: null,
      error: `Too many login attempts. Please try again in ${Math.ceil(limitCheck.resetInSeconds / 60)} minutes.`,
      rateLimited: true,
    };
  }

  // 2. Query SQLite accounts table
  try {
    const row = await db()
      .prepare(
        "SELECT id, email, password_hash, role, name, restaurant_id, status, must_change_password, session_version FROM accounts WHERE LOWER(email) = ?"
      )
      .bind(normalizedEmail)
      .first<{
        id: string;
        email: string;
        password_hash: string;
        role: string;
        name: string;
        restaurant_id?: string | null;
        status?: string;
        must_change_password?: number;
        session_version?: number;
      }>();

    if (row) {
      if (row.status === "suspended") {
        return { user: null, error: "This account has been suspended. Please contact your administrator." };
      }

      const isValid = await verifyPassword(pass, row.password_hash);
      if (isValid) {
        clearRateLimit(`login:${clientIp}:${normalizedEmail}`);
        return {
          user: {
            userId: row.id || row.email,
            email: row.email,
            displayName: row.name || row.email,
            role: (row.role === "super_admin" ? "super_admin" : row.role === "admin" ? "admin" : "waiter") as UserRole,
            restaurantId: row.restaurant_id || undefined,
            mustChangePassword: row.must_change_password === 1,
            sessionVersion: row.session_version || 1,
          },
        };
      }
    }
  } catch (err) {
    console.error("DB authentication lookup failed:", err);
  }

  // 3. Fallback to preset accounts (for offline / seed verification)
  const foundPreset = PRESET_ACCOUNTS.find(
    (acc) => acc.email.toLowerCase() === normalizedEmail && acc.password === pass
  );
  if (foundPreset) {
    clearRateLimit(`login:${clientIp}:${normalizedEmail}`);
    return {
      user: {
        userId: foundPreset.email,
        email: foundPreset.email,
        displayName: foundPreset.displayName,
        role: foundPreset.role,
        restaurantId: foundPreset.restaurantId,
        mustChangePassword: false,
        sessionVersion: 1,
      },
    };
  }

  return { user: null, error: "Invalid email or password." };
}

export function encodeSession(user: AuthUser): string {
  const payload = {
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    restaurantId: user.restaurantId,
    mustChangePassword: !!user.mustChangePassword,
    sv: user.sessionVersion || 1,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function decodeSession(token: string): (AuthUser & { sv?: number }) | null {
  try {
    const parts = token.split(".");
    if (parts.length === 2) {
      const [payloadB64, sig] = parts;
      const expectedSig = signPayload(payloadB64);
      if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
        return null;
      }
      const raw = Buffer.from(payloadB64, "base64url").toString("utf-8");
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.email || typeof parsed.email !== "string") return null;
      if (parsed.exp && parsed.exp < Date.now()) return null;
      return {
        userId: parsed.userId || parsed.email,
        email: parsed.email.toLowerCase(),
        displayName: parsed.displayName || parsed.email,
        role: (parsed.role === "super_admin" ? "super_admin" : parsed.role === "admin" ? "admin" : "waiter") as UserRole,
        restaurantId: parsed.restaurantId,
        mustChangePassword: !!parsed.mustChangePassword,
        sessionVersion: parsed.sv || 1,
        sv: parsed.sv || 1,
      };
    }

    // Backward-compatibility: single base64 payload if created before HMAC addition
    const raw = Buffer.from(token, "base64url").toString("utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.email || typeof parsed.email !== "string") return null;
    if (parsed.exp && parsed.exp < Date.now()) return null;
    return {
      userId: parsed.userId || parsed.email,
      email: parsed.email.toLowerCase(),
      displayName: parsed.displayName || parsed.email,
      role: (parsed.role === "super_admin" ? "super_admin" : parsed.role === "admin" ? "admin" : "waiter") as UserRole,
      restaurantId: parsed.restaurantId,
      mustChangePassword: !!parsed.mustChangePassword,
      sessionVersion: parsed.sv || 1,
      sv: parsed.sv || 1,
    };
  } catch {
    return null;
  }
}

/**
 * Get the currently authenticated user and validate real-time DB status & session version.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return null;
    const session = decodeSession(token);
    if (!session) return null;

    // Validate active status & session version against DB
    try {
      const dbRow = await db()
        .prepare(
          "SELECT id, role, restaurant_id, status, must_change_password, session_version, name FROM accounts WHERE LOWER(email) = ?"
        )
        .bind(session.email)
        .first<{
          id: string;
          role: string;
          restaurant_id?: string | null;
          status?: string;
          must_change_password?: number;
          session_version?: number;
          name?: string;
        }>();

      if (dbRow) {
        if (dbRow.status === "suspended") return null;
        if (session.sv && dbRow.session_version && dbRow.session_version !== session.sv) {
          // Session was revoked (e.g. password reset or admin revoke)
          return null;
        }

        return {
          userId: dbRow.id || session.userId,
          email: session.email,
          displayName: dbRow.name || session.displayName,
          role: (dbRow.role === "super_admin" ? "super_admin" : dbRow.role === "admin" ? "admin" : "waiter") as UserRole,
          restaurantId: dbRow.restaurant_id || undefined,
          mustChangePassword: dbRow.must_change_password === 1,
          sessionVersion: dbRow.session_version || 1,
        };
      }
    } catch {
      // In case DB lookup fails temporarily, proceed with signed session
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Server-side authorization guard.
 * Validates permissions and restaurant scoping.
 */
export async function verifyAuthorization(options?: {
  allowedRoles?: UserRole[];
  restaurantId?: string;
  allowPasswordChangeOnly?: boolean;
}): Promise<{ ok: boolean; status: number; error?: string; user?: AuthUser }> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, status: 401, error: "Please sign in to continue." };
  }

  // Force first-login password change
  if (user.mustChangePassword && !options?.allowPasswordChangeOnly) {
    return {
      ok: false,
      status: 403,
      error: "You must change your temporary password before accessing the system.",
      user,
    };
  }

  // Validate role
  if (options?.allowedRoles && !options.allowedRoles.includes(user.role)) {
    return { ok: false, status: 403, error: "You do not have permission to perform this action.", user };
  }

  // Validate restaurant scoping
  if (options?.restaurantId) {
    // Super Admin can access every restaurant
    if (user.role === "super_admin") {
      return { ok: true, status: 200, user };
    }

    // Admin & Waiter are strictly bound to their assigned restaurant
    if (user.restaurantId !== options.restaurantId) {
      return {
        ok: false,
        status: 403,
        error: "Access denied. You can only access your assigned restaurant.",
        user,
      };
    }
  }

  return { ok: true, status: 200, user };
}

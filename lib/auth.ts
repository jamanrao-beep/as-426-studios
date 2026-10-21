import { cookies, headers } from "next/headers";
import { AuthUser, AUTH_COOKIE_NAME, UserRole } from "./auth-constants";
import { db } from "@/db/store";
import { verifyPassword } from "./password";
import { ensureSaasTables } from "./saas";
import { rateLimit, clearRateLimit } from "./rate-limit";
import crypto from "node:crypto";

export { AUTH_COOKIE_NAME, type AuthUser };

const SESSION_SECRET = process.env.SESSION_SECRET || "";

function signPayload(dataStr: string): string {
  if (!SESSION_SECRET) throw new Error("SESSION_SECRET is not configured on the server.");
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
    throw err;
  }

  try {
    await ensureSaasTables();
    const pending = await db()
      .prepare("SELECT password_hash, status FROM registration_requests WHERE email = ? ORDER BY created_at DESC")
      .bind(normalizedEmail)
      .first<{ password_hash: string; status: string }>();
    if (pending && (await verifyPassword(pass, pending.password_hash))) {
      if (pending.status === "pending") return { user: null, error: "Your restaurant request is under review. We will approve it soon." };
      if (pending.status === "rejected") return { user: null, error: "Your restaurant request was not approved. Please contact Table Secret support." };
    }
  } catch {}

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
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 2) {
      // Security: Strictly reject unsigned tokens. No fallback to unsigned base64 payloads.
      return null;
    }

    const [payloadB64, sig] = parts;
    if (!payloadB64 || !sig) return null;

    const expectedSig = signPayload(payloadB64);
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
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
  } catch {
    return null;
  }
}

/**
 * Get the currently authenticated user and validate real-time DB status & session version.
 */
export type AuthFailure = "none" | "invalid" | "removed" | "suspended" | "revoked" | "expired" | "unavailable";

/**
 * Works out who is signed in, and when nobody is, why. The mobile app uses the reason to tell a person
 * "your account was removed" instead of silently signing them out.
 */
export async function resolveAuth(): Promise<{ user: AuthUser | null; reason: AuthFailure }> {
  try {
    const cookieStore = await cookies();
    // The mobile app sends its session token as a bearer header. When present it wins over any cookie.
    let token: string | undefined;
    const bearer = (await headers()).get("authorization") || "";
    if (/^Bearer\s+/i.test(bearer)) token = bearer.replace(/^Bearer\s+/i, "").trim();
    if (!token) token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return { user: null, reason: "none" };
    const session = decodeSession(token);
    if (!session) return { user: null, reason: "invalid" };

    // Validate the account against the database on every request.
    let dbRow:
      | {
          id: string;
          role: string;
          restaurant_id?: string | null;
          status?: string;
          must_change_password?: number;
          session_version?: number;
          name?: string;
        }
      | null;
    try {
      dbRow = await db()
        .prepare(
          "SELECT id, role, restaurant_id, status, must_change_password, session_version, name FROM accounts WHERE LOWER(email) = ?"
        )
        .bind(session.email)
        .first();
    } catch {
      return { user: null, reason: "unavailable" };
    }

    // The account was deleted by an admin (or a guest sandbox ended): the old token must stop working.
    if (!dbRow) {
      let guestEnded = false;
      try {
        guestEnded = /@guest\.tablesecret\.app$/i.test(session.email);
      } catch {}
      return { user: null, reason: guestEnded ? "expired" : "removed" };
    }
    if (dbRow.status === "suspended") return { user: null, reason: "suspended" };
    if (session.sv && dbRow.session_version && dbRow.session_version !== session.sv) {
      // Session was revoked (e.g. password reset, email changed or admin revoke)
      return { user: null, reason: "revoked" };
    }

    return {
      user: {
        userId: dbRow.id || session.userId,
        email: session.email,
        displayName: dbRow.name || session.displayName,
        role: (dbRow.role === "super_admin" ? "super_admin" : dbRow.role === "admin" ? "admin" : "waiter") as UserRole,
        restaurantId: dbRow.restaurant_id || undefined,
        mustChangePassword: dbRow.must_change_password === 1,
        sessionVersion: dbRow.session_version || 1,
      },
      reason: "none",
    };
  } catch {
    return { user: null, reason: "unavailable" };
  }
}

export async function getAuthUser(): Promise<AuthUser | null> {
  return (await resolveAuth()).user;
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

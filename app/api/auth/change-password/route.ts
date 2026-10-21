import { NextResponse } from "next/server";
import { getAuthUser, encodeSession, AUTH_COOKIE_NAME } from "@/lib/auth";
import { db, sameOrigin } from "@/db/store";
import { rateLimitDb } from "@/lib/rate-limit-db";
import { fail, readJson, weakPassword } from "@/lib/http";
import { hashPassword, verifyPassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in to change your password." }, { status: 401 });
    }

    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const read = await readJson(req, 10_000);
    if (!read.ok) return read.res;
    const { currentPassword, newPassword } = (read.data || {}) as { currentPassword?: string; newPassword?: string };
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return NextResponse.json({ error: "Please provide both current and new password." }, { status: 400 });
    }
    // Guessing the current password from a stolen session is slowed down just like signing in.
    const tries = await rateLimitDb(`chpw:${user.email.toLowerCase()}`, 8, 15 * 60 * 1000);
    if (!tries.allowed) return NextResponse.json({ error: "Too many attempts. Please try again in a few minutes." }, { status: 429 });

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Please provide both current and new password." }, { status: 400 });
    }

    const weak = weakPassword(newPassword, user.email);
    if (weak) return NextResponse.json({ error: weak }, { status: 400 });

    if (currentPassword === newPassword) {
      return NextResponse.json({ error: "New password must be different from current password." }, { status: 400 });
    }

    // Look up current password hash from DB
    const row = await db()
      .prepare("SELECT id, email, password_hash, role, name, restaurant_id, session_version FROM accounts WHERE LOWER(email) = ?")
      .bind(user.email.toLowerCase())
      .first<{
        id: string;
        email: string;
        password_hash: string;
        role: string;
        name: string;
        restaurant_id?: string | null;
        session_version?: number;
      }>();

    if (!row) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const isCurrentValid = await verifyPassword(currentPassword, row.password_hash);
    if (!isCurrentValid) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }

    // Hash new password securely
    const newHash = await hashPassword(newPassword);
    const now = new Date().toISOString();

    await db()
      .prepare(
        `UPDATE accounts 
         SET password_hash = ?, must_change_password = 0, session_version = session_version + 1, updated_at = ?
         WHERE LOWER(email) = ?`
      )
      .bind(newHash, now, user.email.toLowerCase())
      .run();

    await logAudit({
      action: "password_changed",
      actorId: row.id,
      actorEmail: row.email,
      actorRole: row.role,
      targetType: "account",
      targetId: row.id,
    });

    // Update session cookie with mustChangePassword = false
    // Changing the password signs out every other device: the version moves on and only this new token matches.
    const updatedUser = {
      ...user,
      mustChangePassword: false,
      sessionVersion: (row.session_version || 1) + 1,
    };
    const newToken = encodeSession(updatedUser);

    const response = NextResponse.json({
      success: true,
      ...(req.headers.get("x-client") === "mobile" ? { token: newToken } : {}),
      message: "Password changed successfully.",
      user: {
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        role: updatedUser.role,
        restaurantId: updatedUser.restaurantId,
      },
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: newToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err) {
    return fail(err, "POST /api/auth/change-password", "Failed to change password.", 500);
  }
}

import { access, db, sameOrigin } from "@/db/store";
import { SUPER_ADMIN_EMAIL } from "@/lib/auth-constants";
import { hashPassword, generateTemporaryPassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import crypto from "node:crypto";

export async function GET(req: Request) {
  try {
    const a = await access();
    if (!a.owner) {
      return Response.json({ error: "Super Admin access required." }, { status: 403 });
    }

    const rows = await db()
      .prepare(`
        SELECT id, email, role, name, restaurant_id, status, must_change_password, session_version, created_at, updated_at
        FROM accounts
        WHERE role != 'waiter'
        ORDER BY created_at DESC
      `)
      .all<{
        id: string;
        email: string;
        role: string;
        name: string;
        restaurant_id: string | null;
        status: string;
        must_change_password: number;
        session_version: number;
        created_at: string;
        updated_at: string;
      }>();

    return Response.json({ managers: rows.results }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error("GET /api/managers error:", err);
    return Response.json({ error: "Failed to load restaurant admin accounts." }, { status: 503 });
  }
}

const managerActionSchema = z.object({
  action: z.enum(["create", "edit", "reassign", "toggle_status", "reset_password", "revoke_sessions", "remove"]),
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().max(80).optional(),
  restaurant_id: z.string().max(60).optional(),
  temporary_password: z.string().min(4).max(100).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return Response.json({ error: "Request rejected." }, { status: 403 });

    const a = await access();
    if (!a.owner) {
      return Response.json({ error: "Super Admin access required." }, { status: 403 });
    }

    const raw = await req.json();
    const parsed = managerActionSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ error: "Invalid account parameters." }, { status: 400 });
    }

    const { action, email, name, restaurant_id, temporary_password, status } = parsed.data;
    const now = new Date().toISOString();

    // Prevent modifying Super Admin account via this endpoint
    if (email === SUPER_ADMIN_EMAIL.toLowerCase() && action !== "edit") {
      return Response.json({ error: "Super Admin account cannot be modified or deleted here." }, { status: 400 });
    }

    if (action === "create") {
      if (!restaurant_id) {
        return Response.json({ error: "Please assign a restaurant to this Admin account." }, { status: 400 });
      }

      // Check if account already exists
      const existing = await db().prepare("SELECT email FROM accounts WHERE LOWER(email) = ?").bind(email).first();
      if (existing) {
        return Response.json({ error: "An account with this email already exists." }, { status: 400 });
      }

      const tempPass = temporary_password?.trim() || generateTemporaryPassword();
      const passHash = await hashPassword(tempPass);
      const accId = "acc_" + crypto.randomBytes(6).toString("hex");

      await db()
        .prepare(`
          INSERT INTO accounts (id, email, password_hash, name, role, restaurant_id, status, must_change_password, session_version, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'admin', ?, 'active', 1, 1, ?, ?)
        `)
        .bind(accId, email, passHash, name || "Restaurant Manager", restaurant_id, now, now)
        .run();

      // Legacy compatibility table
      await db().prepare("INSERT OR IGNORE INTO restaurant_members (restaurant_id, email) VALUES (?, ?)").bind(restaurant_id, email).run();

      await logAudit({
        action: "account_created",
        actorId: a.email,
        actorEmail: a.email,
        actorRole: "super_admin",
        targetType: "admin_account",
        targetId: accId,
        details: { email, restaurant_id, name },
      });

      return Response.json({
        ok: true,
        account: { id: accId, email, name: name || "Restaurant Manager", restaurant_id, temporary_password: tempPass },
      });
    }

    if (action === "edit") {
      await db()
        .prepare("UPDATE accounts SET name = ?, updated_at = ? WHERE LOWER(email) = ?")
        .bind(name || "", now, email)
        .run();

      await logAudit({
        action: "account_updated",
        actorEmail: a.email,
        actorRole: "super_admin",
        targetType: "account",
        targetId: email,
        details: { name },
      });

      return Response.json({ ok: true });
    }

    if (action === "reassign") {
      if (!restaurant_id) {
        return Response.json({ error: "New restaurant ID is required." }, { status: 400 });
      }

      await db()
        .prepare("UPDATE accounts SET restaurant_id = ?, updated_at = ? WHERE LOWER(email) = ?")
        .bind(restaurant_id, now, email)
        .run();

      // Update legacy restaurant_members
      await db().prepare("DELETE FROM restaurant_members WHERE LOWER(email) = ?").bind(email).run();
      await db().prepare("INSERT INTO restaurant_members (restaurant_id, email) VALUES (?, ?)").bind(restaurant_id, email).run();

      await logAudit({
        action: "account_updated",
        actorEmail: a.email,
        actorRole: "super_admin",
        targetType: "account",
        targetId: email,
        details: { reassigned_to: restaurant_id },
      });

      return Response.json({ ok: true });
    }

    if (action === "toggle_status") {
      const newStatus = status || "suspended";

      // If suspending, bump session_version to invalidate any active sessions immediately
      await db()
        .prepare("UPDATE accounts SET status = ?, session_version = session_version + 1, updated_at = ? WHERE LOWER(email) = ?")
        .bind(newStatus, now, email)
        .run();

      await logAudit({
        action: newStatus === "suspended" ? "account_suspended" : "account_reactivated",
        actorEmail: a.email,
        actorRole: "super_admin",
        targetType: "account",
        targetId: email,
      });

      return Response.json({ ok: true, status: newStatus });
    }

    if (action === "reset_password") {
      const tempPass = temporary_password?.trim() || generateTemporaryPassword();
      const passHash = await hashPassword(tempPass);

      // Invalidate existing sessions and require password change on next login
      await db()
        .prepare(`
          UPDATE accounts 
          SET password_hash = ?, must_change_password = 1, session_version = session_version + 1, updated_at = ?
          WHERE LOWER(email) = ?
        `)
        .bind(passHash, now, email)
        .run();

      await logAudit({
        action: "password_reset",
        actorEmail: a.email,
        actorRole: "super_admin",
        targetType: "account",
        targetId: email,
      });

      return Response.json({ ok: true, temporary_password: tempPass });
    }

    if (action === "revoke_sessions") {
      await db()
        .prepare("UPDATE accounts SET session_version = session_version + 1, updated_at = ? WHERE LOWER(email) = ?")
        .bind(now, email)
        .run();

      await logAudit({
        action: "sessions_revoked",
        actorEmail: a.email,
        actorRole: "super_admin",
        targetType: "account",
        targetId: email,
      });

      return Response.json({ ok: true, message: "All active sessions revoked." });
    }

    if (action === "remove") {
      await db().prepare("DELETE FROM accounts WHERE LOWER(email) = ?").bind(email).run();
      await db().prepare("DELETE FROM restaurant_members WHERE LOWER(email) = ?").bind(email).run();

      await logAudit({
        action: "account_removed",
        actorEmail: a.email,
        actorRole: "super_admin",
        targetType: "account",
        targetId: email,
      });

      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unsupported action." }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/managers error:", err);
    return Response.json({ error: err?.message || "Failed to process manager action." }, { status: 503 });
  }
}

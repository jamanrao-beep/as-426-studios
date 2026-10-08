import { access, db, sameOrigin, validSlug, readMenu } from "@/db/store";
import { hashPassword, generateTemporaryPassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import crypto from "node:crypto";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const restaurantParam = url.searchParams.get("restaurant");
    const a = await access(restaurantParam || undefined);

    if (!a.allowed && !a.owner) {
      return Response.json({ error: "Restaurant manager or Super Admin access required." }, { status: 403 });
    }

    let query = `
      SELECT id, email, name, restaurant_id, status, must_change_password, session_version, created_at, updated_at
      FROM accounts
      WHERE role = 'waiter'
    `;
    const params: string[] = [];

    if (!a.owner || restaurantParam) {
      const restId = a.owner ? restaurantParam! : a.restaurantId!;
      query += " AND restaurant_id = ?";
      params.push(restId);
    }

    query += " ORDER BY name, email";

    const rows = await db()
      .prepare(query)
      .bind(...params)
      .all<{
        id: string;
        email: string;
        name: string;
        restaurant_id: string;
        status: string;
        must_change_password: number;
        session_version: number;
        created_at: string;
        updated_at: string;
      }>();

    return Response.json({ waiters: rows.results }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error("GET /api/waiters error:", err);
    return Response.json({ error: "Failed to load waiters." }, { status: 503 });
  }
}

const waiterActionSchema = z.object({
  action: z.enum(["add", "create", "edit", "toggle_status", "reset_password", "remove"]),
  restaurant: z.string().refine(validSlug).optional(),
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().max(80).optional(),
  temporary_password: z.string().min(4).max(100).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return Response.json({ error: "Request rejected." }, { status: 403 });

    const raw = await req.json();
    const p = waiterActionSchema.safeParse(raw);
    if (!p.success) {
      return Response.json({ error: "Invalid waiter parameters." }, { status: 400 });
    }

    const { action, email, name, temporary_password, status } = p.data;
    let restaurant = p.data.restaurant;

    const a = await access(restaurant);
    if (!a.allowed && !a.owner) {
      return Response.json({ error: "Restaurant manager or Super Admin access required." }, { status: 403 });
    }

    // For restaurant admin, lock restaurant to their own assigned restaurant strictly!
    if (!a.owner) {
      restaurant = a.restaurantId;
    }

    if (!restaurant) {
      return Response.json({ error: "Assigned restaurant is required." }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (action === "add" || action === "create") {
      if (!name) return Response.json({ error: "Enter the waiter’s name." }, { status: 400 });

      // Ensure email does not collide with a super admin
      const existing = await db().prepare("SELECT id, role FROM accounts WHERE LOWER(email) = ?").bind(email).first<{ id: string; role: string }>();
      if (existing && existing.role !== "waiter") {
        return Response.json(
          { error: "This email is registered with higher privileges. Please use a distinct waiter email." },
          { status: 409 }
        );
      }

      const tempPass = temporary_password?.trim() || generateTemporaryPassword();
      const passHash = await hashPassword(tempPass);
      const accId = existing?.id || "acc_w_" + crypto.randomBytes(6).toString("hex");

      await db()
        .prepare(`
          INSERT INTO accounts (id, email, password_hash, name, role, restaurant_id, status, must_change_password, session_version, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'waiter', ?, 'active', 1, 1, ?, ?)
          ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, name = excluded.name, restaurant_id = excluded.restaurant_id, must_change_password = 1, updated_at = excluded.updated_at
        `)
        .bind(accId, email, passHash, name, restaurant, now, now)
        .run();

      // Legacy table sync
      await db()
        .prepare("INSERT INTO waiters (restaurant_id, email, name, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(restaurant_id, email) DO UPDATE SET name = excluded.name")
        .bind(restaurant, email, name, now)
        .run();

      await logAudit({
        action: "account_created",
        actorEmail: a.email,
        actorRole: a.role,
        targetType: "waiter_account",
        targetId: accId,
        details: { email, restaurant_id: restaurant, name },
      });

      return Response.json({
        ok: true,
        waiter: { id: accId, email, name, restaurant_id: restaurant, temporary_password: tempPass },
      });
    }

    if (action === "edit") {
      await db().prepare("UPDATE accounts SET name = ?, updated_at = ? WHERE LOWER(email) = ? AND role = 'waiter'").bind(name || "", now, email).run();
      await db().prepare("UPDATE waiters SET name = ? WHERE restaurant_id = ? AND LOWER(email) = ?").bind(name || "", restaurant, email).run();

      await logAudit({
        action: "account_updated",
        actorEmail: a.email,
        actorRole: a.role,
        targetType: "waiter_account",
        targetId: email,
        details: { name },
      });

      return Response.json({ ok: true });
    }

    if (action === "toggle_status") {
      const newStatus = status || "suspended";
      await db()
        .prepare("UPDATE accounts SET status = ?, session_version = session_version + 1, updated_at = ? WHERE LOWER(email) = ? AND role = 'waiter'")
        .bind(newStatus, now, email)
        .run();

      await logAudit({
        action: newStatus === "suspended" ? "account_suspended" : "account_reactivated",
        actorEmail: a.email,
        actorRole: a.role,
        targetType: "waiter_account",
        targetId: email,
      });

      return Response.json({ ok: true, status: newStatus });
    }

    if (action === "reset_password") {
      const tempPass = temporary_password?.trim() || generateTemporaryPassword();
      const passHash = await hashPassword(tempPass);

      await db()
        .prepare(`
          UPDATE accounts 
          SET password_hash = ?, must_change_password = 1, session_version = session_version + 1, updated_at = ?
          WHERE LOWER(email) = ? AND role = 'waiter'
        `)
        .bind(passHash, now, email)
        .run();

      await logAudit({
        action: "password_reset",
        actorEmail: a.email,
        actorRole: a.role,
        targetType: "waiter_account",
        targetId: email,
      });

      return Response.json({ ok: true, temporary_password: tempPass });
    }

    if (action === "remove") {
      await db().prepare("DELETE FROM accounts WHERE LOWER(email) = ? AND role = 'waiter'").bind(email).run();
      await db().prepare("DELETE FROM waiters WHERE restaurant_id = ? AND LOWER(email) = ?").bind(restaurant, email).run();

      await logAudit({
        action: "account_removed",
        actorEmail: a.email,
        actorRole: a.role,
        targetType: "waiter_account",
        targetId: email,
      });

      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unsupported action." }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/waiters error:", err);
    return Response.json({ error: err?.message || "Failed to update waiter." }, { status: 503 });
  }
}

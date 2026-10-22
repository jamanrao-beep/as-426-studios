import { isGuestEmail, GUEST_MAX_WAITERS } from "@/lib/saas";
import { access, db, denied, sameOrigin, validSlug } from "@/db/store";
import { hashPassword, generateTemporaryPassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";
import { featureOff } from "@/lib/enforce";
import { fail, isDuplicate, readJson } from "@/lib/http";
import { z } from "zod";
import { checkUsernameShape, staffLogin } from "@/lib/usernames";
import crypto from "node:crypto";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const restaurantParam = url.searchParams.get("restaurant");
    if (restaurantParam && !validSlug(restaurantParam)) return Response.json({ error: "Invalid restaurant." }, { status: 400 });
    const a = await access(restaurantParam || undefined);

    if (!a.allowed && !a.owner) {
      return denied(a, "Restaurant manager or Super Admin access required.");
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
  } catch (err) {
    return fail(err, "GET /api/waiters", "Failed to load waiters.");
  }
}

const waiterActionSchema = z.object({
  action: z.enum(["add", "create", "edit", "toggle_status", "reset_password", "remove"]),
  restaurant: z.string().refine(validSlug).optional(),
  // An existing waiter is found by their login ID. A new waiter is made from a username, unique at this restaurant.
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  username: z.string().trim().toLowerCase().max(30).optional(),
  name: z.string().trim().max(80).optional(),
  temporary_password: z.string().min(4).max(100).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return Response.json({ error: "Request rejected." }, { status: 403 });

    const body = await readJson(req);
    if (!body.ok) return body.res;
    const p = waiterActionSchema.safeParse(body.data);
    if (!p.success) {
      return Response.json({ error: "Invalid waiter parameters." }, { status: 400 });
    }

    const { action, name, temporary_password, status } = p.data;
    let email = p.data.email || "";
    let restaurant = p.data.restaurant;

    const a = await access(restaurant);
    if (!a.allowed && !a.owner) {
      return denied(a, "Restaurant manager or Super Admin access required.");
    }

    // A manager is locked to their own restaurant, whatever the request says.
    if (!a.owner) {
      restaurant = a.restaurantId;
      const off = await featureOff(a, "manager.waiterManagement");
      if (off) return off;
    }

    if (!restaurant) {
      return Response.json({ error: "Assigned restaurant is required." }, { status: 400 });
    }
    // A new waiter signs in as username@restaurant-code.as426studios.com.
    if ((action === "add" || action === "create") && p.data.username) {
      const shape = checkUsernameShape(p.data.username);
      if (!shape.ok) return Response.json({ error: shape.reason }, { status: 400 });
      email = staffLogin(p.data.username, restaurant);
    }
    if (!email) return Response.json({ error: "Enter a username for the waiter." }, { status: 400 });
    if (a.owner) {
      const exists = await db().prepare("SELECT id FROM restaurants WHERE id = ?").bind(restaurant).first();
      if (!exists) return Response.json({ error: "Restaurant not found." }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (action === "add" || action === "create") {
      if (await isGuestEmail(a.email)) {
        const count = await db().prepare("SELECT COUNT(*) AS n FROM accounts WHERE role = 'waiter' AND restaurant_id = ?").bind(restaurant).first<{ n: number }>();
        if (Number(count?.n || 0) >= GUEST_MAX_WAITERS) {
          return Response.json({ error: "The guest sandbox allows one staff account. Register your restaurant for more." }, { status: 403 });
        }
      }
      if (!name) return Response.json({ error: "Enter the waiter’s name." }, { status: 400 });

      // The email must be free, or already this restaurant's own waiter. It can never be taken from another restaurant.
      const existing = await db()
        .prepare("SELECT id, role, restaurant_id FROM accounts WHERE LOWER(email) = ?")
        .bind(email)
        .first<{ id: string; role: string; restaurant_id: string | null }>();
      // A username that is already taken is always refused: it belongs to someone, and adding it again must never reset
      // their password or rename them.
      if (existing && (!!p.data.username || existing.role !== "waiter" || existing.restaurant_id !== restaurant)) {
        return Response.json({ error: p.data.username ? `The username "${p.data.username}" is already used at this restaurant. Try another, for example ${p.data.username}2.` : "That login is already in use. Please use a different one." }, { status: 409 });
      }

      const tempPass = temporary_password?.trim() || generateTemporaryPassword();
      const passHash = await hashPassword(tempPass);
      const accId = existing?.id || "acc_w_" + crypto.randomBytes(6).toString("hex");

      // A brand new waiter is a plain INSERT. It must never be an "insert or update": on MySQL that would also fire when
      // two people are added with the same login at the same moment, and the second would overwrite the first one's
      // password. Only re-adding a waiter this restaurant already has (the older email form) refreshes that account.
      const insertSql = `
            INSERT INTO accounts (id, email, password_hash, name, role, restaurant_id, status, must_change_password, session_version, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'waiter', ?, 'active', 1, 1, ?, ?)`;
      const refreshSql = `
            ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, name = excluded.name, must_change_password = 1, session_version = accounts.session_version + 1, updated_at = excluded.updated_at`;
      try {
        await db()
          .prepare(existing ? insertSql + refreshSql : insertSql)
          .bind(accId, email, passHash, name, restaurant, now, now)
          .run();
      } catch (e) {
        // Two identical requests raced and the other one won.
        if (isDuplicate(e)) return Response.json({ error: "That waiter already exists." }, { status: 409 });
        throw e;
      }

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
        waiter: { id: accId, email, name, restaurant_id: restaurant, restaurant_code: restaurant, temporary_password: tempPass },
      });
    }

    // Every change below is scoped to this restaurant, so a manager can never touch another restaurant's waiter.
    const changed = async (res: { meta: { changes?: number } }) => (res.meta.changes ? null : Response.json({ error: "Waiter not found in this restaurant." }, { status: 404 }));

    if (action === "edit") {
      if (!name) return Response.json({ error: "Enter the waiter’s name." }, { status: 400 });
      const res = await db().prepare("UPDATE accounts SET name = ?, updated_at = ? WHERE LOWER(email) = ? AND role = 'waiter' AND restaurant_id = ?").bind(name, now, email, restaurant).run();
      const nf = await changed(res);
      if (nf) return nf;
      await db().prepare("UPDATE waiters SET name = ? WHERE restaurant_id = ? AND LOWER(email) = ?").bind(name, restaurant, email).run();

      await logAudit({ action: "account_updated", actorEmail: a.email, actorRole: a.role, targetType: "waiter_account", targetId: email, details: { name } });
      return Response.json({ ok: true });
    }

    if (action === "toggle_status") {
      const newStatus = status || "suspended";
      const res = await db()
        .prepare("UPDATE accounts SET status = ?, session_version = session_version + 1, updated_at = ? WHERE LOWER(email) = ? AND role = 'waiter' AND restaurant_id = ?")
        .bind(newStatus, now, email, restaurant)
        .run();
      const nf = await changed(res);
      if (nf) return nf;

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
      const res = await db()
        .prepare(`
          UPDATE accounts
          SET password_hash = ?, must_change_password = 1, session_version = session_version + 1, updated_at = ?
          WHERE LOWER(email) = ? AND role = 'waiter' AND restaurant_id = ?
        `)
        .bind(passHash, now, email, restaurant)
        .run();
      const nf = await changed(res);
      if (nf) return nf;

      await logAudit({ action: "password_reset", actorEmail: a.email, actorRole: a.role, targetType: "waiter_account", targetId: email });
      return Response.json({ ok: true, temporary_password: tempPass });
    }

    if (action === "remove") {
      const res = await db().prepare("DELETE FROM accounts WHERE LOWER(email) = ? AND role = 'waiter' AND restaurant_id = ?").bind(email, restaurant).run();
      const nf = await changed(res);
      if (nf) return nf;
      await db().prepare("DELETE FROM waiters WHERE restaurant_id = ? AND LOWER(email) = ?").bind(restaurant, email).run();
      await db().prepare("DELETE FROM push_tokens WHERE LOWER(user_email) = ?").bind(email).run().catch(() => {});

      await logAudit({ action: "account_removed", actorEmail: a.email, actorRole: a.role, targetType: "waiter_account", targetId: email });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unsupported action." }, { status: 400 });
  } catch (err) {
    return fail(err, "POST /api/waiters", "Failed to update waiter.");
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { access, db, sameOrigin, validSlug } from "@/db/store";
import { logAudit } from "@/lib/audit";
import { hashPassword, generateTemporaryPassword } from "@/lib/password";
import { deleteRestaurantData, ensureSaasTables } from "@/lib/saas";

export const dynamic = "force-dynamic";

type AccountRow = { id: string; email: string; name: string; role: string; restaurant_id: string | null; status: string; created_at: string };

// Super Admin: every restaurant with its managers and waiters, in one place.
export async function GET() {
  try {
    const a = await access();
    if (!a.owner) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    await ensureSaasTables();
    const restaurants = await db()
      .prepare("SELECT id, name, address, contact_phone, contact_email, status, created_at FROM restaurants WHERE status != 'archived' ORDER BY name")
      .all<{ id: string; name: string; address: string; contact_phone: string; contact_email: string; status: string; created_at: string }>();
    const accounts = await db()
      .prepare("SELECT id, email, name, role, restaurant_id, status, created_at FROM accounts WHERE role != 'super_admin' ORDER BY name, email")
      .all<AccountRow>();
    const guests = await db()
      .prepare("SELECT email, restaurant_id, contact_email, contact_name, contact_phone, created_at, expires_at FROM guest_accounts ORDER BY created_at DESC")
      .all<{ email: string; restaurant_id: string; contact_email: string | null; contact_name: string | null; contact_phone: string | null; created_at: string; expires_at: string }>();
    const guestIds = new Set(guests.results.map((g) => g.restaurant_id));
    const list = restaurants.results
      .filter((r) => !guestIds.has(r.id))
      .map((r) => ({
        ...r,
        managers: accounts.results.filter((x) => x.restaurant_id === r.id && x.role === "admin"),
        waiters: accounts.results.filter((x) => x.restaurant_id === r.id && x.role === "waiter"),
      }));
    return NextResponse.json({ restaurants: list, guests: guests.results }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/admin/directory error:", err);
    return NextResponse.json({ error: "Could not load the directory." }, { status: 503 });
  }
}

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add_account"),
    role: z.enum(["admin", "waiter"]),
    restaurant: z.string().refine(validSlug),
    email: z.string().trim().toLowerCase().email().max(190),
    name: z.string().trim().min(1).max(80),
  }),
  z.object({
    action: z.literal("edit_account"),
    id: z.string().min(1).max(80),
    email: z.string().trim().toLowerCase().email().max(190).optional(),
    name: z.string().trim().min(1).max(80).optional(),
    restaurant: z.string().refine(validSlug).optional(),
  }),
  z.object({ action: z.literal("delete_account"), id: z.string().min(1).max(80) }),
  z.object({ action: z.literal("delete_guest"), restaurant: z.string().refine(validSlug) }),
  z.object({
    action: z.literal("edit_restaurant"),
    id: z.string().refine(validSlug),
    name: z.string().trim().min(1).max(70).optional(),
    address: z.string().trim().max(300).optional(),
    contact_phone: z.string().trim().max(40).optional(),
    contact_email: z.string().trim().max(100).optional(),
  }),
  z.object({ action: z.literal("delete_restaurant"), id: z.string().refine(validSlug), confirm: z.string().min(1).max(80) }),
]);

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const a = await access();
    if (!a.owner) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const p = schema.safeParse(await req.json());
    if (!p.success) return NextResponse.json({ error: "Please check the details." }, { status: 400 });
    const d = p.data;
    const now = new Date().toISOString();

    if (d.action === "add_account") {
      const rest = await db().prepare("SELECT id FROM restaurants WHERE id = ?").bind(d.restaurant).first();
      if (!rest) return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
      const exists = await db().prepare("SELECT id FROM accounts WHERE LOWER(email) = ?").bind(d.email).first();
      if (exists) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
      const temp = generateTemporaryPassword();
      const id = "acc_" + crypto.randomBytes(6).toString("hex");
      await db()
        .prepare(
          "INSERT INTO accounts (id, email, password_hash, name, role, restaurant_id, status, must_change_password, session_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', 1, 1, ?, ?)"
        )
        .bind(id, d.email, await hashPassword(temp), d.name, d.role, d.restaurant, now, now)
        .run();
      if (d.role === "waiter") {
        await db().prepare("INSERT OR IGNORE INTO waiters (restaurant_id, email, name, created_at) VALUES (?, ?, ?, ?)").bind(d.restaurant, d.email, d.name, now).run();
      } else {
        await db().prepare("INSERT OR IGNORE INTO restaurant_members (restaurant_id, email) VALUES (?, ?)").bind(d.restaurant, d.email).run();
      }
      await logAudit({ action: "account_created", actorEmail: a.email, actorRole: a.role, targetType: "account", targetId: id, details: { email: d.email, role: d.role } });
      return NextResponse.json({ ok: true, id, temporary_password: temp });
    }

    if (d.action === "edit_account") {
      const row = await db().prepare("SELECT id, email, role, restaurant_id FROM accounts WHERE id = ?").bind(d.id).first<{ id: string; email: string; role: string; restaurant_id: string | null }>();
      if (!row || row.role === "super_admin") return NextResponse.json({ error: "Account not found." }, { status: 404 });
      const newEmail = d.email ?? row.email;
      if (newEmail.toLowerCase() !== row.email.toLowerCase()) {
        const clash = await db().prepare("SELECT id FROM accounts WHERE LOWER(email) = ? AND id != ?").bind(newEmail, row.id).first();
        if (clash) return NextResponse.json({ error: "Another account already uses that email." }, { status: 409 });
      }
      const newRest = d.restaurant ?? row.restaurant_id;
      if (d.restaurant) {
        const target = await db().prepare("SELECT id FROM restaurants WHERE id = ? AND status != 'archived'").bind(d.restaurant).first();
        if (!target) return NextResponse.json({ error: "That restaurant does not exist." }, { status: 404 });
      }
      await db()
        .prepare("UPDATE accounts SET email = ?, name = COALESCE(?, name), restaurant_id = ?, session_version = session_version + 1, updated_at = ? WHERE id = ?")
        .bind(newEmail, d.name ?? null, newRest, now, row.id)
        .run();
      // Keep the older lookup tables in step so nothing points at the old email.
      await db().prepare("UPDATE waiters SET email = ?, restaurant_id = ?, name = COALESCE(?, name) WHERE LOWER(email) = ?").bind(newEmail, newRest, d.name ?? null, row.email.toLowerCase()).run();
      await db().prepare("UPDATE restaurant_members SET email = ?, restaurant_id = ? WHERE LOWER(email) = ?").bind(newEmail, newRest, row.email.toLowerCase()).run();
      await logAudit({ action: "account_updated", actorEmail: a.email, actorRole: a.role, targetType: "account", targetId: row.id, details: { from: row.email, to: newEmail } });
      return NextResponse.json({ ok: true });
    }

    if (d.action === "delete_account") {
      const row = await db().prepare("SELECT id, email, role FROM accounts WHERE id = ?").bind(d.id).first<{ id: string; email: string; role: string }>();
      if (!row || row.role === "super_admin") return NextResponse.json({ error: "Account not found." }, { status: 404 });
      await db().prepare("DELETE FROM accounts WHERE id = ?").bind(row.id).run();
      await db().prepare("DELETE FROM waiters WHERE LOWER(email) = ?").bind(row.email.toLowerCase()).run();
      await db().prepare("DELETE FROM restaurant_members WHERE LOWER(email) = ?").bind(row.email.toLowerCase()).run();
      await db().prepare("DELETE FROM push_tokens WHERE LOWER(user_email) = ?").bind(row.email.toLowerCase()).run().catch(() => {});
      await logAudit({ action: "account_removed", actorEmail: a.email, actorRole: a.role, targetType: "account", targetId: row.id, details: { email: row.email } });
      return NextResponse.json({ ok: true });
    }

    if (d.action === "delete_guest") {
      const g = await db().prepare("SELECT restaurant_id, contact_email FROM guest_accounts WHERE restaurant_id = ?").bind(d.restaurant).first<{ restaurant_id: string; contact_email: string | null }>();
      if (!g) return NextResponse.json({ error: "Guest not found." }, { status: 404 });
      await deleteRestaurantData(d.restaurant);
      await logAudit({ action: "account_removed", actorEmail: a.email, actorRole: a.role, targetType: "guest", targetId: d.restaurant, details: { contact: g.contact_email } });
      return NextResponse.json({ ok: true });
    }

    if (d.action === "edit_restaurant") {
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (d.name !== undefined) { sets.push("name = ?"); vals.push(d.name); }
      if (d.address !== undefined) { sets.push("address = ?"); vals.push(d.address); }
      if (d.contact_phone !== undefined) { sets.push("contact_phone = ?"); vals.push(d.contact_phone); }
      if (d.contact_email !== undefined) { sets.push("contact_email = ?"); vals.push(d.contact_email); }
      if (!sets.length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
      sets.push("updated_at = ?");
      vals.push(now, d.id);
      await db().prepare(`UPDATE restaurants SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
      if (d.name !== undefined) {
        const m = await db().prepare("SELECT data FROM menu WHERE id = ?").bind(d.id).first<{ data: string }>();
        if (m) {
          try {
            const menu = JSON.parse(m.data);
            menu.name = d.name;
            await db().prepare("UPDATE menu SET data = ?, revision = revision + 1 WHERE id = ?").bind(JSON.stringify(menu), d.id).run();
          } catch {}
        }
      }
      await logAudit({ action: "restaurant_updated", actorEmail: a.email, actorRole: a.role, targetType: "restaurant", targetId: d.id });
      return NextResponse.json({ ok: true });
    }

    // delete_restaurant: the name must be typed exactly, like the archive confirmation.
    const rest = await db().prepare("SELECT name FROM restaurants WHERE id = ?").bind(d.id).first<{ name: string }>();
    if (!rest) return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
    if (d.confirm.trim() !== rest.name) return NextResponse.json({ error: "Type the restaurant name exactly to confirm." }, { status: 400 });
    const open = await db().prepare("SELECT COUNT(*) AS n FROM orders WHERE restaurant_id = ? AND status IN ('new','accepted','preparing')").bind(d.id).first<{ n: number }>();
    if (Number(open?.n || 0) > 0) {
      return NextResponse.json({ error: `This restaurant has ${open?.n} live order(s). Finish or cancel them first, or archive the restaurant instead, which keeps its history.` }, { status: 409 });
    }
    await deleteRestaurantData(d.id);
    await logAudit({ action: "restaurant_removed", actorEmail: a.email, actorRole: a.role, targetType: "restaurant", targetId: d.id, details: { name: rest.name } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/admin/directory error:", err);
    return NextResponse.json({ error: "Could not complete that change." }, { status: 503 });
  }
}

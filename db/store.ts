import { getChatGPTUser } from "@/app/chatgpt-auth";
import { sample } from "@/lib/menu";
import { getSqliteD1 } from "@/db/sqlite";

export function db(): D1Database {
  const cfDb = (globalThis as any).DB;
  if (cfDb) return cfDb;
  return getSqliteD1() as unknown as D1Database;
}

export type Access = {
  allowed: boolean;
  owner: boolean;
  studio: boolean;
  email: string;
  restaurantIds: string[];
};

export async function access(restaurantId?: string): Promise<Access> {
  const user = await getChatGPTUser();
  if (!user) return { allowed: false, owner: false, studio: false, email: "", restaurantIds: [] };

  const email = user.email.trim().toLowerCase();
  const ownerEmail = (process.env.OWNER_EMAIL || "admin@as426.com").trim().toLowerCase();
  const owner = user.role === "admin" || email === ownerEmail;
  const member = owner ? null : await db().prepare("SELECT email FROM members WHERE email = ?").bind(email).first();
  const studio = owner || !!member;

  if (studio) return { allowed: true, owner, studio, email, restaurantIds: [] };

  const result = await db()
    .prepare(
      "SELECT rm.restaurant_id FROM restaurant_members rm LEFT JOIN menu m ON m.id = rm.restaurant_id WHERE rm.email = ? AND ((m.id IS NOT NULL AND COALESCE(json_extract(m.data, '$.deleted'), 0) = 0) OR (m.id IS NULL AND rm.restaurant_id = 'ember-spice'))"
    )
    .bind(email)
    .all<{ restaurant_id: string }>();

  const restaurantIds = result.results.map((r) => r.restaurant_id);
  return {
    allowed: restaurantId !== undefined ? restaurantIds.includes(restaurantId) : restaurantIds.length > 0,
    owner: false,
    studio: false,
    email,
    restaurantIds,
  };
}

export async function readMenu(id: string) {
  const row = await db().prepare("SELECT data, revision FROM menu WHERE id = ?").bind(id).first<{ data: string; revision: number }>();
  if (row) {
    const menu = JSON.parse(row.data);
    return menu.deleted ? null : { menu, revision: row.revision };
  }
  return id === "ember-spice" ? { menu: sample, revision: 0 } : null;
}

export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // allow same-process server calls or direct API tests
  return origin === new URL(req.url).origin;
}

export function validSlug(s: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 60;
}

export async function orderAccess(restaurantId?: string, managerOnly = false): Promise<Access> {
  const manager = await access(restaurantId);
  if (manager.studio || managerOnly) return manager;
  if (!manager.email) return manager;

  const rows = await db()
    .prepare(
      "SELECT w.restaurant_id FROM waiters w LEFT JOIN menu m ON m.id = w.restaurant_id WHERE w.email = ? AND ((m.id IS NOT NULL AND COALESCE(json_extract(m.data, '$.deleted'), 0) = 0) OR (m.id IS NULL AND w.restaurant_id = 'ember-spice'))"
    )
    .bind(manager.email)
    .all<{ restaurant_id: string }>();

  const ids = [...new Set([...manager.restaurantIds, ...rows.results.map((r) => r.restaurant_id)])];
  return {
    ...manager,
    restaurantIds: ids,
    allowed: restaurantId !== undefined ? ids.includes(restaurantId) : ids.length > 0,
  };
}

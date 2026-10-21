import crypto from "node:crypto";
import { db } from "@/db/store";
import { hashPassword } from "@/lib/password";

export type PlanKey = "monthly" | "half_yearly" | "yearly";

export const PLANS: Record<PlanKey, { label: string; price: number; strike: number; months: number; blurb: string }> = {
  monthly: { label: "Monthly", price: 2999, strike: 4999, months: 1, blurb: "Pay month to month" },
  half_yearly: { label: "Half-yearly", price: 14999, strike: 29999, months: 6, blurb: "6 months, one payment" },
  yearly: { label: "Yearly", price: 24999, strike: 59999, months: 12, blurb: "Best saver, 12 months" },
};

export const TRIAL_DAYS = 7;
export const GUEST_DAYS = 7;
export const LOGIN_DOMAIN = "as426studios.com";
export const GUEST_MAX_DISHES = 12;
export const GUEST_MAX_WAITERS = 1;

let ready: Promise<void> | null = null;
export function ensureSaasTables() {
  ready ??= (async () => {
    const run = (sql: string) => db().prepare(sql).run();
    await run(`CREATE TABLE IF NOT EXISTS registration_requests (
      id VARCHAR(64) PRIMARY KEY NOT NULL,
      email VARCHAR(190) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      owner_name VARCHAR(120) NOT NULL,
      phone VARCHAR(40) NOT NULL,
      restaurant_name VARCHAR(120) NOT NULL,
      address VARCHAR(300) NOT NULL,
      city VARCHAR(80) NOT NULL,
      lat DOUBLE,
      lng DOUBLE,
      status VARCHAR(16) NOT NULL,
      note VARCHAR(300),
      restaurant_id VARCHAR(80),
      created_at VARCHAR(40) NOT NULL,
      decided_at VARCHAR(40),
      decided_by VARCHAR(190)
    )`);
    await run(`CREATE TABLE IF NOT EXISTS subscriptions (
      restaurant_id VARCHAR(80) PRIMARY KEY NOT NULL,
      status VARCHAR(16) NOT NULL,
      plan VARCHAR(16),
      trial_ends_at VARCHAR(40),
      period_end VARCHAR(40),
      requested_plan VARCHAR(16),
      requested_at VARCHAR(40),
      updated_at VARCHAR(40) NOT NULL,
      updated_by VARCHAR(190)
    )`);
    await run(`CREATE TABLE IF NOT EXISTS guest_accounts (
      email VARCHAR(190) PRIMARY KEY NOT NULL,
      restaurant_id VARCHAR(80) NOT NULL,
      created_at VARCHAR(40) NOT NULL,
      expires_at VARCHAR(40) NOT NULL
    )`);
    await run(`CREATE TABLE IF NOT EXISTS email_codes (
      email VARCHAR(190) PRIMARY KEY NOT NULL,
      code_hash VARCHAR(80) NOT NULL,
      expires_at VARCHAR(40) NOT NULL,
      sent_at VARCHAR(40) NOT NULL,
      attempts INT NOT NULL,
      sends INT NOT NULL,
      window_start VARCHAR(40) NOT NULL
    )`);
    await run(`CREATE TABLE IF NOT EXISTS guest_used (
      email VARCHAR(190) PRIMARY KEY NOT NULL,
      first_at VARCHAR(40) NOT NULL
    )`);
    await run(`CREATE TABLE IF NOT EXISTS restaurant_locations (
      restaurant_id VARCHAR(80) PRIMARY KEY NOT NULL,
      lat DOUBLE,
      lng DOUBLE,
      city VARCHAR(80)
    )`);
    // Columns added after the first release. Ignore the error when they already exist.
    for (const sql of [
      "ALTER TABLE registration_requests ADD COLUMN contact_email VARCHAR(190)",
      "ALTER TABLE registration_requests ADD COLUMN plan_choice VARCHAR(16)",
      "ALTER TABLE guest_accounts ADD COLUMN contact_email VARCHAR(190)",
      "ALTER TABLE guest_accounts ADD COLUMN contact_name VARCHAR(120)",
      "ALTER TABLE guest_accounts ADD COLUMN contact_phone VARCHAR(40)",
    ]) {
      try {
        await run(sql);
      } catch {}
    }
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "restaurant"
  );
}

export async function uniqueSlug(name: string) {
  const base = slugify(name);
  let slug = base;
  for (let i = 0; i < 30; i++) {
    const taken = await db().prepare("SELECT id FROM restaurants WHERE id = ?").bind(slug).first();
    const menu = await db().prepare("SELECT id FROM menu WHERE id = ?").bind(slug).first();
    if (!taken && !menu) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function startTrial(restaurantId: string, by: string, days = TRIAL_DAYS) {
  await ensureSaasTables();
  const now = new Date();
  const ends = new Date(now.getTime() + days * 86400000).toISOString();
  const existing = await db().prepare("SELECT restaurant_id FROM subscriptions WHERE restaurant_id = ?").bind(restaurantId).first();
  if (existing) {
    await db()
      .prepare("UPDATE subscriptions SET status = 'trial', trial_ends_at = ?, updated_at = ?, updated_by = ? WHERE restaurant_id = ?")
      .bind(ends, now.toISOString(), by, restaurantId)
      .run();
  } else {
    await db()
      .prepare("INSERT INTO subscriptions (restaurant_id, status, trial_ends_at, updated_at, updated_by) VALUES (?, 'trial', ?, ?, ?)")
      .bind(restaurantId, ends, now.toISOString(), by)
      .run();
  }
  return ends;
}

export type SubscriptionInfo = {
  status: "trial" | "active" | "expired" | "none";
  plan: PlanKey | "";
  endsAt: string | null;
  msLeft: number;
  requestedPlan: PlanKey | "";
};

export async function getSubscription(restaurantId: string): Promise<SubscriptionInfo> {
  await ensureSaasTables();
  const row = await db()
    .prepare("SELECT status, plan, trial_ends_at, period_end, requested_plan FROM subscriptions WHERE restaurant_id = ?")
    .bind(restaurantId)
    .first<{ status: string; plan: string | null; trial_ends_at: string | null; period_end: string | null; requested_plan: string | null }>();
  if (!row) return { status: "none", plan: "", endsAt: null, msLeft: 0, requestedPlan: "" };
  const isActive = row.status === "active";
  const endsAt = isActive ? row.period_end : row.trial_ends_at;
  const msLeft = endsAt ? new Date(endsAt).getTime() - Date.now() : 0;
  const status = msLeft > 0 ? (isActive ? "active" : "trial") : "expired";
  return {
    status,
    plan: (row.plan as PlanKey) || "",
    endsAt,
    msLeft: Math.max(0, msLeft),
    requestedPlan: (row.requested_plan as PlanKey) || "",
  };
}

export async function isGuestEmail(email: string) {
  await ensureSaasTables();
  const row = await db().prepare("SELECT email FROM guest_accounts WHERE LOWER(email) = ?").bind(email.toLowerCase()).first();
  return !!row;
}

const GUEST_DISHES = [
  { id: "g1", name: "Smoked Paneer Tikka", description: "Charred paneer, mint chutney and lime.", price: 295, category: "Starters", veg: true, available: true, secret: false, allergens: "Milk", spice: "medium", taste: "savoury" },
  { id: "g2", name: "Butter Chicken", description: "Slow-cooked chicken in a creamy tomato gravy.", price: 395, category: "Main Course", veg: false, available: true, secret: false, allergens: "Milk", spice: "mild", taste: "savoury" },
  { id: "g3", name: "Dal Makhani", description: "Black lentils simmered overnight with butter.", price: 325, category: "Main Course", veg: true, available: true, secret: false, allergens: "Milk", spice: "mild", taste: "savoury" },
  { id: "g4", name: "Garlic Naan", description: "Tandoor bread brushed with garlic butter.", price: 85, category: "Breads & Naan", veg: true, available: true, secret: false, allergens: "Wheat, milk", spice: "mild", taste: "savoury" },
  { id: "g5", name: "Mango Cooler", description: "Mango, mint and lime over sparkling water.", price: 165, category: "Drinks", veg: true, available: true, secret: false, allergens: "", spice: "mild", taste: "refreshing" },
  { id: "g6", name: "Chef's Secret Plate", description: "A little of our favourites on one tray.", price: 449, category: "Chef Specials", veg: true, available: true, secret: true, allergens: "Milk, wheat", spice: "mild", taste: "savoury" },
];

const hashCode = (email: string, code: string) =>
  crypto.createHash("sha256").update(`${email.toLowerCase()}:${code}:${process.env.SESSION_SECRET || "dev"}`).digest("hex");

// A 6-digit code emailed to prove the person owns the address. Limited to 5 sends an hour and 1 a minute.
export async function issueEmailCode(email: string): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  await ensureSaasTables();
  const e = email.toLowerCase();
  const now = Date.now();
  const row = await db()
    .prepare("SELECT sent_at, sends, window_start FROM email_codes WHERE email = ?")
    .bind(e)
    .first<{ sent_at: string; sends: number; window_start: string }>();
  let sends = 1;
  let windowStart = new Date(now).toISOString();
  if (row) {
    if (now - new Date(row.sent_at).getTime() < 60000) return { ok: false, error: "Please wait a minute before asking for another code." };
    if (now - new Date(row.window_start).getTime() < 3600000) {
      if (Number(row.sends) >= 5) return { ok: false, error: "Too many codes requested. Please try again in an hour." };
      sends = Number(row.sends) + 1;
      windowStart = row.window_start;
    }
  }
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const expires = new Date(now + 10 * 60000).toISOString();
  if (row) {
    await db()
      .prepare("UPDATE email_codes SET code_hash = ?, expires_at = ?, sent_at = ?, attempts = 0, sends = ?, window_start = ? WHERE email = ?")
      .bind(hashCode(e, code), expires, new Date(now).toISOString(), sends, windowStart, e)
      .run();
  } else {
    await db()
      .prepare("INSERT INTO email_codes (email, code_hash, expires_at, sent_at, attempts, sends, window_start) VALUES (?, ?, ?, ?, 0, 1, ?)")
      .bind(e, hashCode(e, code), expires, new Date(now).toISOString(), windowStart)
      .run();
  }
  return { ok: true, code };
}

export async function checkEmailCode(email: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureSaasTables();
  const e = email.toLowerCase();
  const row = await db()
    .prepare("SELECT code_hash, expires_at, attempts FROM email_codes WHERE email = ?")
    .bind(e)
    .first<{ code_hash: string; expires_at: string; attempts: number }>();
  if (!row) return { ok: false, error: "Ask for a new code first." };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, error: "That code has expired. Ask for a new one." };
  if (Number(row.attempts) >= 5) return { ok: false, error: "Too many wrong tries. Ask for a new code." };
  if (row.code_hash !== hashCode(e, code.trim())) {
    await db().prepare("UPDATE email_codes SET attempts = attempts + 1 WHERE email = ?").bind(e).run();
    return { ok: false, error: "That code is not right. Check it and try again." };
  }
  await db().prepare("DELETE FROM email_codes WHERE email = ?").bind(e).run();
  return { ok: true };
}

// A throwaway sandbox restaurant for a week. One per verified email, so it cannot be restarted forever.
export async function createGuest(contactEmail: string, contactName = "", contactPhone = "") {
  await ensureSaasTables();
  await cleanupGuests();
  const contact = contactEmail.trim().toLowerCase();

  const active = await db()
    .prepare("SELECT email, restaurant_id, expires_at FROM guest_accounts WHERE LOWER(contact_email) = ?")
    .bind(contact)
    .first<{ email: string; restaurant_id: string; expires_at: string }>();
  if (active) return { restaurantId: active.restaurant_id, email: active.email, expires: active.expires_at, existing: true as const };

  const used = await db().prepare("SELECT email FROM guest_used WHERE email = ?").bind(contact).first();
  if (used) throw new GuestUsedError();

  const code = crypto.randomBytes(3).toString("hex");
  const restaurantId = `guest-${code}`;
  const email = `guest-${code}@guest.tablesecret.app`;
  const password = crypto.randomBytes(12).toString("base64url");
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + GUEST_DAYS * 86400000).toISOString();
  const name = `Guest Kitchen ${code.toUpperCase()}`;

  await db()
    .prepare(
      "INSERT INTO restaurants (id, name, slug, address, contact_phone, contact_email, welcome_message, note, status, created_at, updated_at) VALUES (?, ?, ?, '', '', '', ?, ?, 'active', ?, ?)"
    )
    .bind(restaurantId, name, restaurantId, "Welcome to your guest kitchen.", "Guest sandbox: try everything, nothing here is real.", now, now)
    .run();
  const menu = {
    name,
    active: true,
    tagline: "Welcome to your guest kitchen.",
    note: "Guest sandbox: try everything, nothing here is real.",
    dishes: GUEST_DISHES,
  };
  await db().prepare("INSERT INTO menu (id, data, revision) VALUES (?, ?, 1)").bind(restaurantId, JSON.stringify(menu)).run();
  const accId = `acc_g_${code}`;
  await db()
    .prepare(
      "INSERT INTO accounts (id, email, password_hash, name, role, restaurant_id, status, must_change_password, session_version, created_at, updated_at) VALUES (?, ?, ?, ?, 'admin', ?, 'active', 0, 1, ?, ?)"
    )
    .bind(accId, email, await hashPassword(password), "Guest Manager", restaurantId, now, now)
    .run();
  await db()
    .prepare("INSERT INTO guest_accounts (email, restaurant_id, created_at, expires_at, contact_email, contact_name, contact_phone) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(email, restaurantId, now, expires, contact, contactName, contactPhone)
    .run();
  await db().prepare("INSERT INTO guest_used (email, first_at) VALUES (?, ?)").bind(contact, now).run();
  return { restaurantId, email, expires, existing: false as const };
}

export class GuestUsedError extends Error {
  constructor() {
    super("This email already used its guest week. Register your restaurant to continue.");
  }
}

// Remove sandbox restaurants (and everything in them) once they have expired.
export async function cleanupGuests() {
  const old = await db()
    .prepare("SELECT email, restaurant_id FROM guest_accounts WHERE expires_at < ?")
    .bind(new Date().toISOString())
    .all<{ email: string; restaurant_id: string }>();
  for (const g of old.results) await deleteRestaurantData(g.restaurant_id);
}

// Hard delete: everything that belongs to one restaurant.
export async function deleteRestaurantData(restaurantId: string) {
  await ensureSaasTables();
  const tables: Array<[string, string]> = [
    ["orders", "restaurant_id"],
    ["reviews", "restaurant_id"],
    ["dish_ratings", "restaurant_id"],
    ["dish_insights_notifications", "restaurant_id"],
    ["service_requests", "restaurant_id"],
    ["push_tokens", "restaurant_id"],
    ["waiters", "restaurant_id"],
    ["restaurant_members", "restaurant_id"],
    ["accounts", "restaurant_id"],
    ["subscriptions", "restaurant_id"],
    ["restaurant_locations", "restaurant_id"],
    ["guest_accounts", "restaurant_id"],
  ];
  for (const [table, col] of tables) {
    try {
      await db().prepare(`DELETE FROM ${table} WHERE ${col} = ?`).bind(restaurantId).run();
    } catch {
      // A table that does not exist yet has nothing to delete.
    }
  }
  await db().prepare("DELETE FROM menu WHERE id = ?").bind(restaurantId).run();
  await db().prepare("DELETE FROM restaurants WHERE id = ?").bind(restaurantId).run();
}

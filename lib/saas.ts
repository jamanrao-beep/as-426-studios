import crypto from "node:crypto";
import { db } from "@/db/store";
import { cached } from "@/lib/ttl-cache";
import { hashPassword } from "@/lib/password";

export type PlanKey = string;

export type Plan = { key: string; label: string; price: number; strike: number; months: number; blurb: string; best: boolean; active: boolean; sort: number };

// The first three plans, written into the database once. After that the Super Admin owns the price list.
const DEFAULT_PLANS: Plan[] = [
  { key: "monthly", label: "Monthly", price: 2999, strike: 4999, months: 1, blurb: "Pay month to month", best: false, active: true, sort: 1 },
  { key: "yearly", label: "Yearly", price: 24999, strike: 59999, months: 12, blurb: "Best saver, 12 months", best: true, active: true, sort: 2 },
  { key: "half_yearly", label: "Half-yearly", price: 14999, strike: 29999, months: 6, blurb: "6 months, one payment", best: false, active: true, sort: 3 },
];

type PlanRow = { plan_key: string; label: string; price: number; strike: number; months: number; blurb: string; best: number; active: number; sort: number };
const toPlan = (r: PlanRow): Plan => ({ key: r.plan_key, label: r.label, price: Number(r.price), strike: Number(r.strike), months: Number(r.months), blurb: r.blurb || "", best: !!r.best, active: !!r.active, sort: Number(r.sort) });

export async function listPlans(opts: { activeOnly?: boolean } = {}): Promise<Plan[]> {
  await ensureSaasTables();
  const rows = await db()
    .prepare(`SELECT plan_key, label, price, strike, months, blurb, best, active, sort FROM plans ${opts.activeOnly ? "WHERE active = 1" : ""} ORDER BY sort, price`)
    .all<PlanRow>();
  return rows.results.map(toPlan);
}

export async function getPlan(key: string): Promise<Plan | null> {
  await ensureSaasTables();
  const r = await db()
    .prepare("SELECT plan_key, label, price, strike, months, blurb, best, active, sort FROM plans WHERE plan_key = ?")
    .bind(key)
    .first<PlanRow>();
  return r ? toPlan(r) : null;
}

// A new restaurant gets 7 free days plus a 7-day welcome bonus, shown to them as one 14-day trial.
export const TRIAL_BASE_DAYS = 7;
export const TRIAL_BONUS_DAYS = 7;
export const TRIAL_DAYS = TRIAL_BASE_DAYS + TRIAL_BONUS_DAYS;
export const GUEST_DAYS = 7;
import { LOGIN_DOMAIN as LOGIN_DOMAIN_NAME } from "@/lib/login-id";
export const LOGIN_DOMAIN = LOGIN_DOMAIN_NAME;
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
    await run(`CREATE TABLE IF NOT EXISTS plans (
      plan_key VARCHAR(16) PRIMARY KEY NOT NULL,
      label VARCHAR(40) NOT NULL,
      price INT NOT NULL,
      strike INT NOT NULL,
      months INT NOT NULL,
      blurb VARCHAR(160) NOT NULL,
      best INT NOT NULL,
      active INT NOT NULL,
      sort INT NOT NULL,
      updated_at VARCHAR(40) NOT NULL
    )`);
    const havePlans = await db().prepare("SELECT COUNT(*) AS n FROM plans").first<{ n: number }>();
    if (!Number(havePlans?.n || 0)) {
      for (const p of DEFAULT_PLANS) {
        await db()
          .prepare("INSERT INTO plans (plan_key, label, price, strike, months, blurb, best, active, sort, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(p.key, p.label, p.price, p.strike, p.months, p.blurb, p.best ? 1 : 0, p.active ? 1 : 0, p.sort, new Date().toISOString())
          .run();
      }
    }
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
    await run(`CREATE TABLE IF NOT EXISTS support_questions (
      id VARCHAR(40) PRIMARY KEY NOT NULL,
      created_at VARCHAR(40) NOT NULL,
      name VARCHAR(120),
      email VARCHAR(190) NOT NULL,
      role VARCHAR(20),
      restaurant VARCHAR(120),
      question TEXT NOT NULL,
      emailed INT NOT NULL DEFAULT 0
    )`);
    // One row per attempt to pay for a plan online. The amount is fixed on the server when the row is made.
    await run(`CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(40) PRIMARY KEY NOT NULL,
      restaurant_id VARCHAR(80) NOT NULL,
      plan_key VARCHAR(16) NOT NULL,
      amount INT NOT NULL,
      status VARCHAR(16) NOT NULL,
      kind VARCHAR(8) NOT NULL,
      provider_ref VARCHAR(80),
      provider_payment VARCHAR(80),
      paid_by VARCHAR(190),
      created_at VARCHAR(40) NOT NULL,
      paid_at VARCHAR(40)
    )`);
    // A manager asks for another manager at their restaurant. Nothing happens until the Super Admin approves.
    await run(`CREATE TABLE IF NOT EXISTS manager_proposals (
      id VARCHAR(40) PRIMARY KEY NOT NULL,
      restaurant_id VARCHAR(80) NOT NULL,
      proposed_by VARCHAR(190) NOT NULL,
      proposer_name VARCHAR(120),
      name VARCHAR(120) NOT NULL,
      username VARCHAR(40) NOT NULL,
      contact_email VARCHAR(190) NOT NULL,
      phone VARCHAR(40),
      status VARCHAR(16) NOT NULL,
      note VARCHAR(300),
      login_email VARCHAR(190),
      created_at VARCHAR(40) NOT NULL,
      decided_at VARCHAR(40),
      decided_by VARCHAR(190)
    )`);
    // Columns and indexes added after the first release. They run once and are then marked done, so a normal start
    // does not try them again (and does not fill the logs with "already exists" errors).
    await run("CREATE TABLE IF NOT EXISTS schema_marks (mark VARCHAR(60) PRIMARY KEY NOT NULL, applied_at VARCHAR(40) NOT NULL)");
    const done = await db().prepare("SELECT mark FROM schema_marks WHERE mark = ?").bind("saas-v4").first();
    if (!done) for (const sql of [
      "ALTER TABLE registration_requests ADD COLUMN contact_email VARCHAR(190)",
      "ALTER TABLE registration_requests ADD COLUMN plan_choice VARCHAR(16)",
      "ALTER TABLE guest_accounts ADD COLUMN contact_email VARCHAR(190)",
      "ALTER TABLE guest_accounts ADD COLUMN contact_name VARCHAR(120)",
      "ALTER TABLE guest_accounts ADD COLUMN contact_phone VARCHAR(40)",
      "CREATE INDEX idx_accounts_restaurant_role ON accounts (restaurant_id, role)",
      "CREATE INDEX idx_orders_restaurant_status_created ON orders (restaurant_id, status, created_at)",
      "CREATE INDEX idx_support_user ON support_questions (user_email)",
      "CREATE INDEX idx_push_user ON push_tokens (user_email)",
      "ALTER TABLE support_questions ADD COLUMN phone VARCHAR(40)",
      "ALTER TABLE support_questions ADD COLUMN user_email VARCHAR(190)",
      "ALTER TABLE support_questions ADD COLUMN restaurant_id VARCHAR(80)",
      "ALTER TABLE support_questions ADD COLUMN status VARCHAR(12)",
      "ALTER TABLE support_questions ADD COLUMN reply TEXT",
      "ALTER TABLE support_questions ADD COLUMN replied_at VARCHAR(40)",
      "ALTER TABLE support_questions ADD COLUMN reply_seen INT",
    ]) {
      try {
        await run(sql);
      } catch {}
    }
    if (!done) await db().prepare("INSERT OR IGNORE INTO schema_marks (mark, applied_at) VALUES (?, ?)").bind("saas-v4", new Date().toISOString()).run();
    // An email address the Super Admin attached by hand to an account that had none, so it can reset its password.
    await run(`CREATE TABLE IF NOT EXISTS account_contacts (
      login VARCHAR(190) PRIMARY KEY NOT NULL,
      contact_email VARCHAR(190) NOT NULL,
      name VARCHAR(120),
      set_by VARCHAR(190),
      updated_at VARCHAR(40) NOT NULL
    )`);
    // The restaurant code a sign-up asked for, so the owner sees their full login ID right away.
    const done6 = await db().prepare("SELECT mark FROM schema_marks WHERE mark = ?").bind("saas-v6").first();
    if (!done6) {
      try {
        await run("ALTER TABLE registration_requests ADD COLUMN restaurant_code VARCHAR(60)");
      } catch {}
      await db().prepare("INSERT OR IGNORE INTO schema_marks (mark, applied_at) VALUES (?, ?)").bind("saas-v6", new Date().toISOString()).run();
    }
    // Added later, with its own mark: a payment reference can belong to one payment only.
    const done5 = await db().prepare("SELECT mark FROM schema_marks WHERE mark = ?").bind("saas-v5").first();
    if (!done5) {
      try {
        await run("CREATE UNIQUE INDEX idx_payments_ref ON payments (provider_ref)");
      } catch {}
      await db().prepare("INSERT OR IGNORE INTO schema_marks (mark, applied_at) VALUES (?, ?)").bind("saas-v5", new Date().toISOString()).run();
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

export function getSubscription(restaurantId: string): Promise<SubscriptionInfo> {
  return cached(`sub:${restaurantId}`, 5000, () => getSubscriptionNow(restaurantId));
}

async function getSubscriptionNow(restaurantId: string): Promise<SubscriptionInfo> {
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

export function isGuestEmail(email: string) {
  return cached(`guest:${email.toLowerCase()}`, 20000, () => isGuestEmailNow(email));
}

async function isGuestEmailNow(email: string) {
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

// Make a plan active: the one place that works out the new end date. Renewing the same plan adds to the time left.
// Switching to another plan starts from today, so a monthly and a yearly never pile up into one confusing end date.
export async function activatePlan(restaurantId: string, planKey: string, by: string) {
  const chosen = await getPlan(planKey);
  if (!chosen) throw new Error("That plan no longer exists.");
  const now = new Date();
  const current = await getSubscription(restaurantId);
  const renewing = current.status === "active" && current.plan === planKey && !!current.endsAt;
  const end = new Date(renewing ? new Date(current.endsAt as string) : now);
  end.setMonth(end.getMonth() + chosen.months);
  const have = await db().prepare("SELECT restaurant_id FROM subscriptions WHERE restaurant_id = ?").bind(restaurantId).first();
  if (have) {
    await db()
      .prepare("UPDATE subscriptions SET status = 'active', plan = ?, period_end = ?, requested_plan = NULL, requested_at = NULL, updated_at = ?, updated_by = ? WHERE restaurant_id = ?")
      .bind(planKey, end.toISOString(), now.toISOString(), by, restaurantId)
      .run();
  } else {
    await db()
      .prepare("INSERT INTO subscriptions (restaurant_id, status, plan, period_end, updated_at, updated_by) VALUES (?, 'active', ?, ?, ?, ?)")
      .bind(restaurantId, planKey, end.toISOString(), now.toISOString(), by)
      .run();
  }
  return end.toISOString();
}

// A payment came back as paid (from the buyer's browser or from Razorpay's webhook, whichever lands first). It is
// settled exactly once: the row is claimed before the plan is activated, so a repeat does nothing.
export async function settlePayment(providerRef: string, paymentId: string, paidPaise?: number | null) {
  await ensureSaasTables();
  const row = await db()
    .prepare("SELECT id, restaurant_id, plan_key, amount, status FROM payments WHERE provider_ref = ?")
    .bind(providerRef)
    .first<{ id: string; restaurant_id: string; plan_key: string; amount: number; status: string }>();
  if (!row) return { ok: false as const, reason: "unknown" as const };
  if (row.status === "paid") return { ok: true as const, already: true, restaurantId: row.restaurant_id, plan: row.plan_key };
  if (paidPaise != null && Number(paidPaise) !== Number(row.amount)) return { ok: false as const, reason: "amount" as const };
  const now = new Date().toISOString();
  const claim = await db().prepare("UPDATE payments SET status = 'paid', provider_payment = ?, paid_at = ? WHERE id = ? AND status = 'created'").bind(paymentId, now, row.id).run();
  if (!claim.meta.changes) return { ok: true as const, already: true, restaurantId: row.restaurant_id, plan: row.plan_key };
  try {
    await activatePlan(row.restaurant_id, row.plan_key, `payment:${paymentId}`);
  } catch (e) {
    // Money was taken but the plan could not be switched on: put the row back so the next webhook retry finishes it.
    await db().prepare("UPDATE payments SET status = 'created', paid_at = NULL WHERE id = ?").bind(row.id).run().catch(() => {});
    throw e;
  }
  return { ok: true as const, already: false, restaurantId: row.restaurant_id, plan: row.plan_key };
}

// Make a restaurant and its first manager in one go. Used when the Super Admin approves a sign-up and when they
// onboard a restaurant by hand. The manager's login ID is `username@restaurant-code.as426studios.com`. If anything
// fails half way, nothing is left behind.
export async function createRestaurantWithOwner(p: {
  restaurantName: string;
  address: string;
  city?: string;
  phone: string;
  contactEmail: string;
  lat?: number | null;
  lng?: number | null;
  ownerName: string;
  username: string;
  passwordHash: string;
  mustChange: boolean;
  by: string;
  // The restaurant code the owner asked for. Used when it is still free, otherwise one is made from the name.
  code?: string;
}) {
  const { staffLogin } = await import("@/lib/usernames");
  await ensureSaasTables();
  const now = new Date().toISOString();
  let restaurantId = "";
  if (p.code) {
    const [r, m] = await Promise.all([
      db().prepare("SELECT id FROM restaurants WHERE id = ?").bind(p.code).first(),
      db().prepare("SELECT id FROM menu WHERE id = ?").bind(p.code).first(),
    ]);
    if (!r && !m) restaurantId = p.code;
  }
  if (!restaurantId) restaurantId = await uniqueSlug(p.restaurantName);
  const loginEmail = staffLogin(p.username, restaurantId);
  try {
    await db()
      .prepare(
        "INSERT INTO restaurants (id, name, slug, address, contact_phone, contact_email, welcome_message, note, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, '', 'active', ?, ?)"
      )
      .bind(restaurantId, p.restaurantName, restaurantId, p.city ? `${p.address}, ${p.city}` : p.address, p.phone, p.contactEmail || "", `Welcome to ${p.restaurantName}.`, now, now)
      .run();
    await db()
      .prepare("INSERT INTO menu (id, data, revision) VALUES (?, ?, 1)")
      .bind(restaurantId, JSON.stringify({ name: p.restaurantName, active: true, tagline: `Welcome to ${p.restaurantName}.`, note: "", dishes: [] }))
      .run();
    await db()
      .prepare(
        "INSERT INTO accounts (id, email, password_hash, name, role, restaurant_id, status, must_change_password, session_version, created_at, updated_at) VALUES (?, ?, ?, ?, 'admin', ?, 'active', ?, 1, ?, ?)"
      )
      .bind("acc_" + crypto.randomBytes(6).toString("hex"), loginEmail, p.passwordHash, p.ownerName, restaurantId, p.mustChange ? 1 : 0, now, now)
      .run();
    await db().prepare("INSERT OR IGNORE INTO restaurant_members (restaurant_id, email) VALUES (?, ?)").bind(restaurantId, loginEmail).run();
    if (p.lat != null && p.lng != null) {
      await db().prepare("INSERT INTO restaurant_locations (restaurant_id, lat, lng, city) VALUES (?, ?, ?, ?)").bind(restaurantId, p.lat, p.lng, p.city || "").run();
    }
    return { restaurantId, loginEmail };
  } catch (e) {
    await deleteRestaurantData(restaurantId).catch(() => {});
    throw e;
  }
}

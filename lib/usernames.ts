import { db } from "@/db/store";
import { LOGIN_DOMAIN } from "@/lib/saas";

// A person signs in with a login ID. Every account belongs to one restaurant, and the ID carries that restaurant:
//
//     rahul@spice-route.as426studios.com      username "rahul" at the restaurant with code "spice-route"
//
// So a username only has to be free INSIDE its own restaurant. Two restaurants can each have a "rahul". Inside one
// restaurant, two people with the same name need different usernames (rahul and rahul2). Accounts made before this
// existed keep their old `name@as426studios.com` ID and still sign in with it.
export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;

const RESERVED = new Set(["admin", "administrator", "root", "support", "help", "info", "owner", "manager", "staff", "waiter", "tablesecret", "table-secret", "as426", "as426studios", "superadmin", "super-admin", "system", "noreply", "no-reply", "postmaster", "security", "billing", "sales", "team", "official"]);

export const loginDomainFor = (restaurantCode: string) => `${restaurantCode}.${LOGIN_DOMAIN}`;
export const staffLogin = (username: string, restaurantCode: string) => `${username.trim().toLowerCase()}@${loginDomainFor(restaurantCode)}`;
// The part before the @, whichever form of ID it is.
export const usernameOf = (login: string) => login.split("@")[0].toLowerCase();

export type NameCheck = { ok: true } | { ok: false; status: number; reason: string };

// Is the name acceptable at all (shape and reserved words)? Used wherever a person picks a username.
export function checkUsernameShape(username: string): NameCheck {
  const u = username.trim().toLowerCase();
  if (!USERNAME_RE.test(u)) return { ok: false, status: 400, reason: "Use 3 to 30 letters, numbers, dots or dashes." };
  if (RESERVED.has(u)) return { ok: false, status: 400, reason: "That username is reserved. Please choose another." };
  return { ok: true };
}

// Is the username free at this restaurant? It must not be an account there already, nor a manager request waiting there.
export async function checkUsernameAt(username: string, restaurantCode: string): Promise<NameCheck> {
  const shape = checkUsernameShape(username);
  if (!shape.ok) return shape;
  const u = username.trim().toLowerCase();
  const login = staffLogin(u, restaurantCode);
  const [account, proposal] = await Promise.all([
    db().prepare("SELECT id FROM accounts WHERE LOWER(email) = ?").bind(login).first(),
    db().prepare("SELECT id FROM manager_proposals WHERE restaurant_id = ? AND username = ? AND status IN ('pending','approving')").bind(restaurantCode, u).first(),
  ]);
  if (account || proposal) return { ok: false, status: 409, reason: `The username "${u}" is already used at your restaurant. Try another, for example ${u}2.` };
  return { ok: true };
}

// Two managers can ask for the same new username at the same instant and both pass the check above. After saving, each
// request looks at who asked first (earliest time, then id) among the requests at this restaurant for this username.
// Everyone but the first backs out, so there is one winner.
export async function firstInLine(username: string, restaurantCode: string, myId: string): Promise<boolean> {
  const rows = await db()
    .prepare("SELECT id, created_at FROM manager_proposals WHERE restaurant_id = ? AND username = ? AND status IN ('pending','approving')")
    .bind(restaurantCode, username.trim().toLowerCase())
    .all<{ id: string; created_at: string }>();
  const all = rows.results.sort((x, y) => (x.created_at === y.created_at ? (x.id < y.id ? -1 : 1) : x.created_at < y.created_at ? -1 : 1));
  return !all.length || all[0].id === myId;
}

// The sign-in form can send a full login ID, or a restaurant code plus a username. Either way this gives the ID.
export function composeLogin(input: { email?: unknown; username?: unknown; restaurant?: unknown }): string {
  const clean = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");
  const email = clean(input.email);
  if (email) return email;
  const username = clean(input.username);
  const code = clean(input.restaurant).replace(/^@+/, "");
  if (!username) return "";
  if (username.includes("@")) return username;
  // No restaurant code: the Super Admin and older accounts type their whole ID, so this only helps the old short form.
  return code && /^[a-z0-9][a-z0-9-]{0,60}$/.test(code) ? staffLogin(username, code) : `${username}@${LOGIN_DOMAIN}`;
}

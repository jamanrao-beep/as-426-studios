import { db } from "@/db/store";
import { composeLogin } from "@/lib/usernames";
import { LOGIN_DOMAIN } from "@/lib/login-id";

// Where to write to about someone's account. Waiters have no email of their own, so they get none. Everyone else has the
// real inbox they gave (and, for new accounts, proved with a code) when they signed up or were set up. An address the
// Super Admin attached by hand to an account that had none comes first.
export async function contactEmailOf(login: string): Promise<{ email: string; name?: string } | null> {
  const l = login.trim().toLowerCase();
  if (!l || /@guest\./.test(l)) return null;
  const attached = await db()
    .prepare("SELECT contact_email, name FROM account_contacts WHERE login = ?")
    .bind(l)
    .first<{ contact_email: string; name: string | null }>();
  if (attached?.contact_email) return { email: attached.contact_email, name: attached.name || undefined };
  const signup = await db()
    .prepare("SELECT contact_email, owner_name FROM registration_requests WHERE LOWER(email) = ? AND status = 'approved'")
    .bind(l)
    .first<{ contact_email: string | null; owner_name: string }>();
  if (signup?.contact_email) return { email: signup.contact_email, name: signup.owner_name };
  const proposal = await db()
    .prepare("SELECT contact_email, name FROM manager_proposals WHERE LOWER(login_email) = ? AND status = 'approved'")
    .bind(l)
    .first<{ contact_email: string; name: string }>();
  if (proposal?.contact_email) return { email: proposal.contact_email, name: proposal.name };
  // Restaurants set up by hand keep the owner's email on the restaurant. It belongs to the original owner only: any
  // other manager without an inbox of their own gets no email, so their password is never sent to someone else.
  const owner = await db()
    .prepare("SELECT a.restaurant_id AS rid, a.name AS name, r.contact_email AS contact_email FROM accounts a JOIN restaurants r ON r.id = a.restaurant_id WHERE LOWER(a.email) = ? AND a.role = 'admin'")
    .bind(l)
    .first<{ rid: string; name: string; contact_email: string | null }>();
  if (owner?.contact_email) {
    const first = await db()
      .prepare("SELECT email FROM accounts WHERE restaurant_id = ? AND role = 'admin' ORDER BY created_at ASC, id ASC LIMIT 1")
      .bind(owner.rid)
      .first<{ email: string }>();
    if (first && first.email.toLowerCase() === l) return { email: owner.contact_email, name: owner.name };
  }
  // A manager whose login IS a real email address (made by hand, e.g. someone@gmail.com) is written to at that address.
  // Our own login forms (name@as426studios.com, name@code) are not mailboxes, so they never count.
  const internal = /@as426studios\.com$|\.as426studios\.com$|@guest\./.test(l);
  if (!internal && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l)) {
    const acct = await db().prepare("SELECT role, name FROM accounts WHERE LOWER(email) = ?").bind(l).first<{ role: string; name: string }>();
    if (acct?.role === "admin") return { email: l, name: acct.name };
  }
  return null;
}

export type ResetReason = "ok" | "no_account" | "super_admin" | "waiter" | "suspended" | "no_contact";

export const RESET_EXPLANATION: Record<ResetReason, string> = {
  ok: "This account can reset its password by email: a code goes to the address on file.",
  no_account: "No account has that login. Check the restaurant code and username. An older account signs in with name@as426studios.com and no restaurant code.",
  super_admin: "This is the Super Admin account. It is never reset by email, on purpose.",
  waiter: "Waiters have no email of their own. Their manager resets their password from Manage waiters.",
  suspended: "This account is suspended. Reactivate it first.",
  no_contact: "The account exists but has no email address on file (it was created by hand without one). Attach an email below, and the reset code will go there.",
};

export type ResetTarget = {
  login: string;
  id: string;
  role: string;
  name: string;
  reason: ResetReason;
  contact: { email: string; name?: string } | null;
};

// Finds the account a "Forgot password" request is about. A person with an older account (name@as426studios.com) may
// still type a restaurant code, so that form is tried too when the new-style login does not exist.
export async function lookupForReset(input: { email?: unknown; username?: unknown; restaurant?: unknown }): Promise<ResetTarget | null> {
  const composed = composeLogin(input);
  if (!composed) return null;
  const candidates = [composed];
  const bare = String(input.username || "").trim().toLowerCase();
  if (bare && !bare.includes("@")) candidates.push(`${bare}@${LOGIN_DOMAIN}`);
  let missing: ResetTarget | null = null;
  for (const login of [...new Set(candidates)]) {
    const row = await db()
      .prepare("SELECT id, email, role, status, name FROM accounts WHERE LOWER(email) = ?")
      .bind(login)
      .first<{ id: string; email: string; role: string; status: string; name: string }>();
    if (!row) {
      missing ||= { login, id: "", role: "", name: "", reason: "no_account", contact: null };
      continue;
    }
    const base = { login: row.email.toLowerCase(), id: row.id, role: row.role, name: row.name };
    if (row.role === "super_admin") return { ...base, reason: "super_admin", contact: null };
    if (row.role === "waiter") return { ...base, reason: "waiter", contact: null };
    if (row.status === "suspended") return { ...base, reason: "suspended", contact: null };
    const contact = await contactEmailOf(base.login);
    return contact ? { ...base, reason: "ok", contact } : { ...base, reason: "no_contact", contact: null };
  }
  return missing;
}

// jo***@gmail.com
export function maskEmail(e: string) {
  const [u, d] = e.split("@");
  return u ? `${u.slice(0, 2)}${"*".repeat(Math.max(1, Math.min(6, u.length - 2)))}@${d}` : e;
}

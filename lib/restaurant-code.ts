import { db } from "@/db/store";
import { slugify } from "@/lib/saas";

// A restaurant code is the short name that goes after the @ in every login at that restaurant (rahul@spice-route). It is
// also the restaurant's address in links (/r/spice-route). The owner picks it when they sign up.
export const CODE_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/; // 3 to 40 characters, hyphens only in the middle

// Words that would clash with pages, systems or the guest sandbox.
const RESERVED = new Set([
  "admin", "api", "www", "app", "login", "logout", "team", "plans", "guest", "apply", "forgot-password", "terms", "privacy", "refunds", "contact",
  "support", "help", "billing", "sales", "owner", "manager", "staff", "waiter", "system", "official", "tablesecret", "table-secret", "as426", "as426studios",
  "demo", "test", "null", "undefined", "static", "assets", "public", "dashboard",
]);

export type CodeCheck = { ok: true } | { ok: false; reason: string; status: number };

export const suggestCode = (restaurantName: string) => slugify(restaurantName).slice(0, 40).replace(/-+$/g, "");

// Is the code acceptable in shape, and not a reserved word?
export function checkCodeShape(code: string): CodeCheck {
  const c = code.trim().toLowerCase();
  if (!CODE_RE.test(c)) return { ok: false, status: 400, reason: "Use 3 to 40 letters, numbers or hyphens, with no spaces. A hyphen cannot be first or last." };
  if (RESERVED.has(c) || c.startsWith("guest-")) return { ok: false, status: 400, reason: "That restaurant code is reserved. Please choose another." };
  return { ok: true };
}

// Is it free? Not a restaurant already, and not wanted by another sign-up that is waiting for approval.
export async function checkCodeFree(code: string, exceptRequestId = ""): Promise<CodeCheck> {
  const shape = checkCodeShape(code);
  if (!shape.ok) return shape;
  const c = code.trim().toLowerCase();
  const [rest, menu, waiting] = await Promise.all([
    db().prepare("SELECT id FROM restaurants WHERE id = ?").bind(c).first(),
    db().prepare("SELECT id FROM menu WHERE id = ?").bind(c).first(),
    db().prepare("SELECT id FROM registration_requests WHERE restaurant_code = ? AND status IN ('pending','approving') AND id != ?").bind(c, exceptRequestId).first(),
  ]);
  if (rest || menu || waiting) return { ok: false, status: 409, reason: `The restaurant code "${c}" is already taken. Try another, for example ${c}-2.` };
  return { ok: true };
}

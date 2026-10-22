import { db } from "@/db/store";

// Where to write to about someone's account. Waiters have no email of their own, so they get none. Everyone else has the
// real inbox they gave (and, for new accounts, proved with a code) when they signed up or were set up.
export async function contactEmailOf(login: string): Promise<{ email: string; name?: string } | null> {
  const l = login.trim().toLowerCase();
  if (!l || /@guest\./.test(l)) return null;
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
  return null;
}

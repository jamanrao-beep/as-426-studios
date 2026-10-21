import { db } from "@/db/store";
import { isGuestEmail } from "@/lib/saas";
import type { AuthUser } from "@/lib/auth-constants";

export type Contact = { name?: string; email?: string; phone?: string; restaurantId?: string; restaurantName?: string; role: string };

// What we already know about the person asking, from the details they gave when they registered
// or started the guest week, so they never have to type it again.
export async function contactFor(user: AuthUser): Promise<Contact> {
  const out: Contact = { role: user.role === "admin" ? "manager" : user.role, name: user.displayName || undefined, restaurantId: user.restaurantId };
  try {
    if (await isGuestEmail(user.email)) {
      const g = await db()
        .prepare("SELECT contact_email, contact_name, contact_phone FROM guest_accounts WHERE LOWER(email) = ?")
        .bind(user.email.toLowerCase())
        .first<{ contact_email: string | null; contact_name: string | null; contact_phone: string | null }>();
      out.role = "guest";
      out.email = g?.contact_email || undefined;
      out.name = g?.contact_name || out.name;
      out.phone = g?.contact_phone || undefined;
    }
    if (user.restaurantId) {
      const r = await db()
        .prepare("SELECT name, contact_phone, contact_email FROM restaurants WHERE id = ?")
        .bind(user.restaurantId)
        .first<{ name: string; contact_phone: string | null; contact_email: string | null }>();
      out.restaurantName = r?.name || undefined;
      if (out.role === "manager") {
        const reg = await db()
          .prepare("SELECT owner_name, phone, contact_email FROM registration_requests WHERE restaurant_id = ? ORDER BY created_at DESC")
          .bind(user.restaurantId)
          .first<{ owner_name: string; phone: string; contact_email: string | null }>();
        out.name = reg?.owner_name || out.name;
        out.email = reg?.contact_email || r?.contact_email || out.email;
        out.phone = reg?.phone || r?.contact_phone || out.phone;
      }
    }
  } catch {}
  return out;
}

import { access, db, sameOrigin } from "@/db/store";
import { SUPER_ADMIN_EMAIL } from "@/lib/auth-constants";
import { z } from "zod";

export async function GET() {
  try {
    const a = await access();
    if (!a.studio && !a.owner) {
      return Response.json({ error: "Super Admin or studio access required." }, { status: 403 });
    }

    const rows = await db()
      .prepare("SELECT email, role, name, restaurant_id, password, created_at FROM accounts ORDER BY created_at DESC")
      .all<{
        email: string;
        role: string;
        name: string;
        restaurant_id: string | null;
        password: string;
        created_at: string;
      }>();

    return Response.json({ managers: rows.results }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Failed to load managers." }, { status: 503 });
  }
}

const managerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(4).max(100).optional(),
  name: z.string().trim().max(80).default(""),
  restaurant_id: z.string().max(60).optional(),
  action: z.enum(["add", "remove"]),
});

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return Response.json({ error: "Request rejected." }, { status: 403 });

    const a = await access();
    if (!a.studio && !a.owner) {
      return Response.json({ error: "Super Admin access required." }, { status: 403 });
    }

    const raw = await req.json();
    const parsed = managerSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ error: "Please provide a valid Gmail/email and password (min 4 characters)." }, { status: 400 });
    }

    const { email, password, name, restaurant_id, action } = parsed.data;

    if (action === "remove") {
      if (email === SUPER_ADMIN_EMAIL.toLowerCase()) {
        return Response.json({ error: "Super Admin cannot be deleted." }, { status: 400 });
      }

      await db().prepare("DELETE FROM accounts WHERE LOWER(email) = ?").bind(email).run();
      await db().prepare("DELETE FROM restaurant_members WHERE LOWER(email) = ?").bind(email).run();
      await db().prepare("DELETE FROM members WHERE LOWER(email) = ?").bind(email).run();
      return Response.json({ ok: true });
    }

    if (!password) {
      return Response.json({ error: "Password is required to add a manager." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const assignedRest = restaurant_id && restaurant_id !== "all" ? restaurant_id : null;

    // 1. Insert or update accounts table
    await db()
      .prepare(
        "INSERT INTO accounts (email, password, role, name, restaurant_id, created_at) VALUES (?, ?, 'admin', ?, ?, ?) ON CONFLICT(email) DO UPDATE SET password = excluded.password, name = excluded.name, restaurant_id = excluded.restaurant_id"
      )
      .bind(email, password, name || "Restaurant Manager", assignedRest, now)
      .run();

    // 2. Assign restaurant permission
    if (assignedRest) {
      await db()
        .prepare("INSERT OR IGNORE INTO restaurant_members (restaurant_id, email) VALUES (?, ?)")
        .bind(assignedRest, email)
        .run();
    } else {
      // Full studio access across all restaurants
      await db()
        .prepare("INSERT OR IGNORE INTO members (email) VALUES (?)")
        .bind(email)
        .run();
    }

    return Response.json({ ok: true, email, password });
  } catch (err: any) {
    return Response.json({ error: err?.message || "Failed to update manager." }, { status: 503 });
  }
}

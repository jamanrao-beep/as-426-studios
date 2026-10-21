import { orderAccess, db, sameOrigin, validSlug } from "@/db/store";
import { rateLimit } from "@/lib/rate-limit";
import { after } from "next/server";
import { notifyRestaurantStaff } from "@/lib/push-server";
import { z } from "zod";
import crypto from "node:crypto";
import { rateLimitDb, clientIp } from "@/lib/rate-limit-db";

export const dynamic = "force-dynamic";

let ready: Promise<void> | null = null;
function ensureTable() {
  ready ??= db()
    .prepare(
      `CREATE TABLE IF NOT EXISTS service_requests (
        id VARCHAR(64) PRIMARY KEY NOT NULL,
        restaurant_id VARCHAR(80) NOT NULL,
        table_label VARCHAR(40) NOT NULL,
        kind VARCHAR(16) NOT NULL,
        status VARCHAR(16) NOT NULL,
        created_at VARCHAR(40) NOT NULL,
        resolved_at VARCHAR(40),
        resolved_by VARCHAR(120)
      )`
    )
    .run()
    .then(() => undefined)
    .catch((e) => {
      ready = null;
      throw e;
    });
  return ready;
}

const postSchema = z.object({
  restaurant: z.string().refine(validSlug),
  table: z.string().trim().min(1).max(30),
  kind: z.enum(["waiter", "bill"]),
});

// Customers: ask for the waiter or the bill. No login needed, so it is rate limited.
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return Response.json({ error: "Request rejected" }, { status: 403 });
    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: "Please enter your table number." }, { status: 400 });
    const { restaurant, table, kind } = parsed.data;

    const ip = clientIp(req);
    const limit = await rateLimitDb(`service:${ip}:${restaurant}:${table.toLowerCase()}`, 4, 5 * 60 * 1000);
    const wide = await rateLimitDb(`service:${ip}:${restaurant}`, 20, 5 * 60 * 1000);
    if (!limit.allowed || !wide.allowed) {
      return Response.json({ error: "Your server has been notified. Please wait a moment." }, { status: 429 });
    }

    await ensureTable();
    const exists = await db().prepare("SELECT id FROM menu WHERE id = ?").bind(restaurant).first();
    if (!exists) return Response.json({ error: "Restaurant not found." }, { status: 404 });

    const backlog = await db().prepare("SELECT COUNT(*) AS n FROM service_requests WHERE restaurant_id = ? AND status = 'open'").bind(restaurant).first<{ n: number }>();
    if (Number(backlog?.n || 0) >= 100) return Response.json({ error: "Your server has been notified. Please wait a moment." }, { status: 429 });
    const open = await db()
      .prepare("SELECT id FROM service_requests WHERE restaurant_id = ? AND table_label = ? AND kind = ? AND status = 'open'")
      .bind(restaurant, table, kind)
      .first();
    if (!open) {
      await db()
        .prepare("INSERT INTO service_requests (id, restaurant_id, table_label, kind, status, created_at) VALUES (?, ?, ?, ?, 'open', ?)")
        .bind(crypto.randomUUID(), restaurant, table, kind, new Date().toISOString())
        .run();
      after(() =>
        notifyRestaurantStaff(restaurant, `Table ${table}`, kind === "bill" ? "Wants the bill" : "Needs a waiter", { type: "service", kind })
      );
    }
    return Response.json({ ok: true });
  } catch (err: any) {
    console.error("[POST /api/service-requests]", err?.message || err);
    return Response.json({ error: "We couldn’t reach your server. Please wave to them." }, { status: 503 });
  }
}

// Staff: list open requests for a restaurant.
export async function GET(req: Request) {
  try {
    const restaurant = new URL(req.url).searchParams.get("restaurant") || "";
    if (!validSlug(restaurant)) return Response.json({ error: "Invalid restaurant" }, { status: 400 });
    const a = await orderAccess(restaurant);
    if (!a.allowed && !a.owner) return Response.json({ error: "Team access required." }, { status: 403 });
    if (!a.owner && !a.restaurantIds.includes(restaurant) && a.restaurantId !== restaurant) {
      return Response.json({ error: "You can only see requests for your own restaurant." }, { status: 403 });
    }
    await ensureTable();
    const rows = await db()
      .prepare("SELECT id, table_label, kind, created_at FROM service_requests WHERE restaurant_id = ? AND status = 'open' ORDER BY created_at ASC LIMIT 50")
      .bind(restaurant)
      .all<{ id: string; table_label: string; kind: string; created_at: string }>();
    return Response.json({ requests: rows.results }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error("[GET /api/service-requests]", err?.message || err);
    return Response.json({ error: "Couldn’t load requests." }, { status: 503 });
  }
}

// Staff: mark a request as done.
export async function PATCH(req: Request) {
  try {
    if (!sameOrigin(req)) return Response.json({ error: "Request rejected" }, { status: 403 });
    const p = z.object({ restaurant: z.string().refine(validSlug), id: z.string().min(1).max(64) }).safeParse(await req.json());
    if (!p.success) return Response.json({ error: "Invalid request" }, { status: 400 });
    const a = await orderAccess(p.data.restaurant);
    if (!a.allowed && !a.owner) return Response.json({ error: "Team access required." }, { status: 403 });
    if (!a.owner && !a.restaurantIds.includes(p.data.restaurant) && a.restaurantId !== p.data.restaurant) {
      return Response.json({ error: "You can only update requests for your own restaurant." }, { status: 403 });
    }
    await ensureTable();
    await db()
      .prepare("UPDATE service_requests SET status = 'done', resolved_at = ?, resolved_by = ? WHERE id = ? AND restaurant_id = ?")
      .bind(new Date().toISOString(), a.email || "", p.data.id, p.data.restaurant)
      .run();
    return Response.json({ ok: true });
  } catch (err: any) {
    console.error("[PATCH /api/service-requests]", err?.message || err);
    return Response.json({ error: "Couldn’t update the request." }, { status: 503 });
  }
}

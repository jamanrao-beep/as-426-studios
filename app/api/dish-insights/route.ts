import { access, db, validSlug, readMenu } from "@/db/store";
import { yesterdayIndiaDate, dayRange, indiaDate } from "@/lib/order-time";
import crypto from "node:crypto";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Generate daily dish insight summary for a restaurant for a given IST date if not already generated.
 */
async function ensureDailySummary(restaurantId: string, targetDate: string) {
  const existing = await db()
    .prepare("SELECT id FROM dish_insights_notifications WHERE restaurant_id = ? AND date = ?")
    .bind(restaurantId, targetDate)
    .first<{ id: string }>();

  if (existing) return existing.id;

  const b = dayRange(targetDate);

  // Delivered orders for target date (IST)
  const orders = await db()
    .prepare(`
      SELECT items, total 
      FROM orders 
      WHERE restaurant_id = ? 
        AND status = 'served' 
        AND COALESCE(is_test, 0) = 0
        AND COALESCE(completed_at, updated_at) >= ? 
        AND COALESCE(completed_at, updated_at) < ?
    `)
    .bind(restaurantId, b.start, b.end)
    .all<{ items: string; total: number }>();

  // Ratings for target date
  const ratings = await db()
    .prepare(`
      SELECT dish_id, dish_name, rating
      FROM dish_ratings
      WHERE restaurant_id = ?
        AND created_at >= ?
        AND created_at < ?
    `)
    .bind(restaurantId, b.start, b.end)
    .all<{ dish_id: string; dish_name: string; rating: number }>();

  // Menu dishes
  const menuRow = await readMenu(restaurantId);
  const menuDishes = menuRow?.menu?.dishes || [];

  const qtyMap = new Map<string, { name: string; qty: number }>();
  for (const d of menuDishes) {
    qtyMap.set(d.id, { name: d.name, qty: 0 });
  }

  for (const o of orders.results) {
    try {
      const items = JSON.parse(o.items) as Array<{ id: string; name: string; quantity: number }>;
      for (const i of items) {
        const curr = qtyMap.get(i.id) || { name: i.name || "Dish", qty: 0 };
        curr.qty += Number(i.quantity) || 1;
        qtyMap.set(i.id, curr);
      }
    } catch {}
  }

  const notificationId = "din_" + crypto.randomBytes(8).toString("hex");
  const now = new Date().toISOString();

  if (orders.results.length === 0) {
    // Honest reporting when no delivered orders exist
    const summaryText = `No delivered sales recorded on ${targetDate}.`;
    await db()
      .prepare(`
        INSERT OR IGNORE INTO dish_insights_notifications (
          id, restaurant_id, date, summary_text, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `)
      .bind(notificationId, restaurantId, targetDate, summaryText, now)
      .run();
    return notificationId;
  }

  // Find best seller
  const sorted = Array.from(qtyMap.entries())
    .map(([id, val]) => ({ id, name: val.name, qty: val.qty }))
    .sort((a, b) => b.qty - a.qty);

  const best = sorted[0]?.qty > 0 ? sorted[0] : null;

  // Find highest rated with at least 5 ratings in day
  const ratingMap = new Map<string, { sum: number; count: number; name: string }>();
  for (const r of ratings.results) {
    const cur = ratingMap.get(r.dish_id) || { sum: 0, count: 0, name: r.dish_name };
    cur.sum += r.rating;
    cur.count += 1;
    ratingMap.set(r.dish_id, cur);
  }

  let topRated: { id: string; name: string; score: number; count: number } | null = null;
  const qualified = Array.from(ratingMap.entries())
    .filter(([_, v]) => v.count >= 5)
    .map(([id, v]) => ({ id, name: v.name, score: Number((v.sum / v.count).toFixed(2)), count: v.count }))
    .sort((a, b) => b.score - a.score);

  if (qualified.length > 0) {
    topRated = qualified[0];
  }

  // Available dishes with zero sales
  const unsoldAvailable = menuDishes
    .filter((d: any) => d.available && (qtyMap.get(d.id)?.qty || 0) === 0)
    .map((d: any) => d.name);

  let summaryParts: string[] = [];
  if (best) {
    summaryParts.push(`Top seller: ${best.name} (${best.qty} sold).`);
  }
  if (topRated) {
    summaryParts.push(`Highest rated: ${topRated.name} (${topRated.score}★ from ${topRated.count} ratings).`);
  }
  if (unsoldAvailable.length > 0) {
    summaryParts.push(`${unsoldAvailable.length} active menu item(s) had zero sales.`);
  }

  const summaryText = summaryParts.join(" ") || `Sales activity recorded on ${targetDate}.`;

  await db()
    .prepare(`
      INSERT OR IGNORE INTO dish_insights_notifications (
        id, restaurant_id, date, best_seller_id, best_seller_name, best_seller_qty,
        top_rated_id, top_rated_name, top_rated_score, top_rated_count,
        zero_sales_count, zero_sales_dishes, summary_text, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      notificationId,
      restaurantId,
      targetDate,
      best?.id || null,
      best?.name || null,
      best?.qty || 0,
      topRated?.id || null,
      topRated?.name || null,
      topRated?.score || null,
      topRated?.count || 0,
      unsoldAvailable.length,
      JSON.stringify(unsoldAvailable),
      summaryText,
      now
    )
    .run();

  return notificationId;
}

export async function GET(req: Request) {
  try {
    const a = await access();
    if (!a.allowed && !a.owner) {
      return Response.json({ error: "Restaurant admin access required." }, { status: 403 });
    }

    if (a.role === "waiter") {
      return Response.json({ error: "Waiters do not have access to dish insight notifications." }, { status: 403 });
    }

    const u = new URL(req.url);
    const filterRest = u.searchParams.get("restaurant") || "";

    let targetRestaurants: string[] = [];
    if (a.owner) {
      if (filterRest) {
        targetRestaurants = [filterRest];
      } else {
        const restRows = await db().prepare("SELECT id FROM restaurants WHERE status != 'archived'").all<{ id: string }>();
        targetRestaurants = restRows.results.map((r) => r.id);
      }
    } else {
      targetRestaurants = a.restaurantIds;
    }

    // Automatically generate missing daily summary for yesterday (IST) upon dashboard opening
    const yesterday = yesterdayIndiaDate();
    for (const rId of targetRestaurants) {
      try {
        await ensureDailySummary(rId, yesterday);
      } catch (err) {
        console.error(`Failed to generate summary for ${rId}:`, err);
      }
    }

    // Query summaries with per-user read tracking
    let query = `
      SELECT 
        n.id,
        n.restaurant_id,
        n.date,
        n.best_seller_id,
        n.best_seller_name,
        n.best_seller_qty,
        n.top_rated_id,
        n.top_rated_name,
        n.top_rated_score,
        n.top_rated_count,
        n.zero_sales_count,
        n.zero_sales_dishes,
        n.summary_text,
        n.created_at,
        r.name as restaurant_name,
        CASE WHEN nr.read_at IS NOT NULL THEN 1 ELSE 0 END as is_read
      FROM dish_insights_notifications n
      LEFT JOIN restaurants r ON r.id = n.restaurant_id
      LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_email = ?
    `;
    const params: unknown[] = [a.email.toLowerCase()];

    if (targetRestaurants.length > 0) {
      query += ` WHERE n.restaurant_id IN (${targetRestaurants.map(() => "?").join(",")})`;
      params.push(...targetRestaurants);
    }

    query += " ORDER BY n.date DESC, n.created_at DESC LIMIT 30";

    const rows = await db()
      .prepare(query)
      .bind(...params)
      .all<any>();

    return Response.json(
      {
        notifications: rows.results.map((row) => ({
          ...row,
          zero_sales_dishes: JSON.parse(row.zero_sales_dishes || "[]"),
          is_read: Boolean(row.is_read),
        })),
        generatorNote: "Summaries are computed upon dashboard opening to ensure fresh insights without requiring external cron daemons.",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("GET /api/dish-insights error:", err);
    return Response.json({ error: "Failed to load dish insights." }, { status: 503 });
  }
}

const readActionSchema = z.object({
  action: z.literal("mark_read"),
  notificationId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const a = await access();
    if (!a.allowed && !a.owner) {
      return Response.json({ error: "Access required." }, { status: 403 });
    }

    const raw = await req.json();
    const p = readActionSchema.safeParse(raw);
    if (!p.success) {
      return Response.json({ error: "Invalid action." }, { status: 400 });
    }

    const now = new Date().toISOString();
    await db()
      .prepare(`
        INSERT OR REPLACE INTO notification_reads (notification_id, user_email, read_at)
        VALUES (?, ?, ?)
      `)
      .bind(p.data.notificationId, a.email.toLowerCase(), now)
      .run();

    return Response.json({ ok: true, notificationId: p.data.notificationId });
  } catch (err: any) {
    console.error("POST /api/dish-insights error:", err);
    return Response.json({ error: "Failed to update notification." }, { status: 503 });
  }
}

import { access, db, sameOrigin, validSlug } from "@/db/store";
import { z } from "zod";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const restaurant = u.searchParams.get("restaurant") || "";
    const isPublic = u.searchParams.get("public") === "1";
    const orderId = u.searchParams.get("order_id");
    const token = u.searchParams.get("token");
    const dishId = u.searchParams.get("dish_id");

    if (!restaurant || !validSlug(restaurant)) {
      return Response.json({ error: "Invalid restaurant parameter." }, { status: 400 });
    }

    // 1. Public aggregates for menu cards
    if (isPublic) {
      const rows = await db()
        .prepare(`
          SELECT 
            dish_id,
            ROUND(AVG(rating), 1) as avg_rating,
            COUNT(*) as rating_count
          FROM dish_ratings
          WHERE restaurant_id = ?
          GROUP BY dish_id
        `)
        .bind(restaurant)
        .all<{ dish_id: string; avg_rating: number; rating_count: number }>();

      const ratingsMap: Record<string, { averageRating: number; ratingCount: number }> = {};
      for (const r of rows.results) {
        ratingsMap[r.dish_id] = {
          averageRating: Number(r.avg_rating) || 0,
          ratingCount: Number(r.rating_count) || 0,
        };
      }

      return Response.json({ ratings: ratingsMap }, { headers: { "Cache-Control": "no-store" } });
    }

    // 2. Customer fetching ratings for their specific completed order
    if (orderId && token) {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const order = await db()
        .prepare("SELECT id, status, is_test FROM orders WHERE id = ? AND restaurant_id = ? AND tracking_hash = ?")
        .bind(orderId, restaurant, tokenHash)
        .first<{ id: string; status: string; is_test: number }>();

      if (!order) {
        return Response.json({ error: "Order not found or invalid credentials." }, { status: 404 });
      }

      const rows = await db()
        .prepare(`
          SELECT dish_id, dish_name, rating, comment, updated_at
          FROM dish_ratings
          WHERE order_id = ? AND restaurant_id = ?
        `)
        .bind(orderId, restaurant)
        .all<{ dish_id: string; dish_name: string; rating: number; comment: string; updated_at: string }>();

      return Response.json({ ratings: rows.results }, { headers: { "Cache-Control": "no-store" } });
    }

    // 3. Admin & Super Admin viewing private feedback
    const a = await access(restaurant);
    if (!a.allowed && !a.owner) {
      return Response.json({ error: "Unauthorized access." }, { status: 403 });
    }

    // Waiters cannot view written comments or ratings
    if (a.role === "waiter") {
      return Response.json({ error: "Waiters are not permitted to access dish ratings or feedback." }, { status: 403 });
    }

    let query = `
      SELECT id, order_id, dish_id, dish_name, rating, comment, created_at, updated_at
      FROM dish_ratings
      WHERE restaurant_id = ?
    `;
    const params: string[] = [restaurant];

    if (dishId) {
      query += " AND dish_id = ?";
      params.push(dishId);
    }

    query += " ORDER BY created_at DESC LIMIT 100";

    const feedbackRows = await db()
      .prepare(query)
      .bind(...params)
      .all<{
        id: string;
        order_id: string;
        dish_id: string;
        dish_name: string;
        rating: number;
        comment: string;
        created_at: string;
        updated_at: string;
      }>();

    return Response.json({ feedback: feedbackRows.results }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error("GET /api/dish-ratings error:", err);
    return Response.json({ error: "Failed to load dish ratings." }, { status: 503 });
  }
}

const rateDishSchema = z.object({
  restaurant: z.string().refine(validSlug),
  orderId: z.string().min(1).max(100),
  token: z.string().min(1).max(100),
  dishId: z.string().min(1).max(100),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional().default(""),
});

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) {
      return Response.json({ error: "Request rejected." }, { status: 403 });
    }

    const raw = await req.json();
    const parsed = rateDishSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ error: "Invalid rating submission parameters." }, { status: 400 });
    }

    const { restaurant, orderId, token, dishId, rating, comment } = parsed.data;

    // 1. Verify customer order credentials using SHA-256 tracking_hash
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const order = await db()
      .prepare(`
        SELECT id, items, status, is_test 
        FROM orders 
        WHERE id = ? AND restaurant_id = ? AND tracking_hash = ?
      `)
      .bind(orderId, restaurant, tokenHash)
      .first<{ id: string; items: string; status: string; is_test: number }>();

    if (!order) {
      return Response.json({ error: "Order not found or access token invalid." }, { status: 403 });
    }

    // 2. Prevent ratings for test orders
    if (order.is_test === 1) {
      return Response.json({ error: "Test orders cannot be rated." }, { status: 400 });
    }

    // 3. Prevent ratings for cancelled orders
    if (order.status === "cancelled") {
      return Response.json({ error: "Cancelled orders cannot be rated." }, { status: 400 });
    }

    // 4. Prevent ratings for unfinished orders (only allowed after staff confirm delivery: 'served')
    if (order.status !== "served") {
      return Response.json(
        { error: "Ratings can only be submitted after your order has been delivered to your table." },
        { status: 400 }
      );
    }

    // 5. Prevent ratings for dishes they did not order
    let orderedItems: Array<{ id: string; name: string; quantity: number }> = [];
    try {
      orderedItems = JSON.parse(order.items);
    } catch {
      return Response.json({ error: "Failed to verify ordered items." }, { status: 500 });
    }

    const matchingItem = orderedItems.find((item) => item.id === dishId);
    if (!matchingItem) {
      return Response.json({ error: "You can only rate dishes that were included in your delivered order." }, { status: 400 });
    }

    const dishName = matchingItem.name || "Dish";
    const now = new Date().toISOString();
    const ratingId = "drate_" + crypto.randomBytes(8).toString("hex");

    // 6. Upsert into dish_ratings (one rating per dish per completed order, allows update without duplicates)
    await db()
      .prepare(`
        INSERT INTO dish_ratings (
          id, order_id, restaurant_id, dish_id, dish_name, rating, comment, customer_token, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(order_id, dish_id) DO UPDATE SET
          rating = excluded.rating,
          comment = excluded.comment,
          dish_name = excluded.dish_name,
          updated_at = excluded.updated_at
      `)
      .bind(
        ratingId,
        orderId,
        restaurant,
        dishId,
        dishName,
        rating,
        comment.trim(),
        tokenHash,
        now,
        now
      )
      .run();

    return Response.json({
      ok: true,
      message: "Your rating has been saved. Thank you for your feedback!",
      dishId,
      rating,
    });
  } catch (err: any) {
    console.error("POST /api/dish-ratings error:", err);
    return Response.json({ error: "Could not save your rating. Please retry." }, { status: 503 });
  }
}

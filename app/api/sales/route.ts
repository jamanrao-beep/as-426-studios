import { access, db, validSlug } from "@/db/store";
import { indiaDate, monthRange } from "@/lib/order-time";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const restaurant = u.searchParams.get("restaurant") || "";
    const month = u.searchParams.get("month") || indiaDate().slice(0, 7);

    const a = await access(restaurant || undefined);
    if (!a.allowed && !a.owner) {
      return Response.json({ error: "Restaurant manager access required." }, { status: 403 });
    }

    // Waiters are strictly forbidden from viewing sales reports
    if (a.role === "waiter") {
      return Response.json({ error: "Waiters are not permitted to view sales reports." }, { status: 403 });
    }

    let range;
    try {
      range = monthRange(month);
    } catch {
      return Response.json({ error: "Invalid month format (expected YYYY-MM)." }, { status: 400 });
    }

    let query = `
      SELECT 
        substr(datetime(COALESCE(completed_at, updated_at), '+330 minutes'), 1, 10) AS day,
        COUNT(*) AS orders,
        SUM(total) AS revenue
      FROM orders
      WHERE status = 'served' 
        AND COALESCE(is_test, 0) = 0
        AND COALESCE(completed_at, updated_at) >= ? 
        AND COALESCE(completed_at, updated_at) < ?
    `;
    const params: unknown[] = [range.start, range.end];

    if (restaurant) {
      query += " AND restaurant_id = ?";
      params.push(restaurant);
    } else if (!a.owner && a.restaurantIds.length > 0) {
      query += ` AND restaurant_id IN (${a.restaurantIds.map(() => "?").join(",")})`;
      params.push(...a.restaurantIds);
    }

    query += " GROUP BY day ORDER BY day";

    const r = await db()
      .prepare(query)
      .bind(...params)
      .all<{ day: string; orders: number; revenue: number }>();

    const days = Array.from({ length: range.days }, (_, i) => {
      const day = month + "-" + String(i + 1).padStart(2, "0");
      const found = r.results.find((row) => row.day === day);
      return {
        day,
        orders: Number(found?.orders || 0),
        revenue: Number(found?.revenue || 0),
      };
    });

    const totalOrders = days.reduce((s, d) => s + d.orders, 0);
    const totalRevenue = days.reduce((s, d) => s + d.revenue, 0);

    return Response.json(
      {
        month,
        days,
        orders: totalOrders,
        revenue: totalRevenue,
        disclaimer: "These are delivered-order gross values based on menu prices. They do not represent verified bank payments or net profit.",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("GET /api/sales error:", err);
    return Response.json({ error: "Sales report unavailable." }, { status: 503 });
  }
}

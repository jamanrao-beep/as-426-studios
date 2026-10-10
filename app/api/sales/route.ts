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
        COALESCE(completed_at, updated_at) AS date_str,
        total
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

    const r = await db()
      .prepare(query)
      .bind(...params)
      .all<{ date_str: string; total: number }>();

    // Map each served order to its IST date
    const dayMap = new Map<string, { orders: number; revenue: number }>();
    for (let i = 1; i <= range.days; i++) {
      const d = month + "-" + String(i).padStart(2, "0");
      dayMap.set(d, { orders: 0, revenue: 0 });
    }

    for (const row of r.results) {
      if (!row.date_str) continue;
      const day = indiaDate(new Date(row.date_str));
      const entry = dayMap.get(day);
      if (entry) {
        entry.orders += 1;
        entry.revenue += Number(row.total || 0);
      }
    }

    const days = Array.from(dayMap.entries()).map(([day, stats]) => ({
      day,
      orders: stats.orders,
      revenue: stats.revenue,
    }));

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

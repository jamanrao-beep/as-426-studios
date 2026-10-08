import { access, db } from "@/db/store";
import { indiaDate, dayRange, monthRange } from "@/lib/order-time";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const a = await access();
    if (!a.owner) {
      return Response.json({ error: "Super Admin access required." }, { status: 403 });
    }

    const u = new URL(req.url);
    const restaurantFilter = u.searchParams.get("restaurant") || "";
    const dateFilter = u.searchParams.get("date") || indiaDate();
    const monthFilter = u.searchParams.get("month") || indiaDate().slice(0, 7);

    // 1. Restaurant metrics
    const restaurantStats = await db()
      .prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended,
          SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused
        FROM restaurants
        WHERE status != 'archived'
      `)
      .first<{ total: number; active: number; suspended: number; paused: number }>();

    // 2. Staff metrics
    const accountStats = await db()
      .prepare(`
        SELECT
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
          SUM(CASE WHEN role = 'waiter' THEN 1 ELSE 0 END) as waiters,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_accounts,
          SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended_accounts
        FROM accounts
      `)
      .first<{ admins: number; waiters: number; active_accounts: number; suspended_accounts: number }>();

    // 3. Orders & Sales for Selected Date (default: today IST)
    let dayBounds;
    try {
      dayBounds = dayRange(dateFilter);
    } catch {
      dayBounds = dayRange(indiaDate());
    }

    let todayOrdersQuery = `
      SELECT 
        COUNT(*) as order_count,
        SUM(CASE WHEN status = 'served' AND COALESCE(is_test, 0) = 0 THEN total ELSE 0 END) as delivered_sales,
        SUM(CASE WHEN status = 'served' THEN 1 ELSE 0 END) as delivered_count,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count
      FROM orders
      WHERE created_at >= ? AND created_at < ?
    `;
    const todayParams: unknown[] = [dayBounds.start, dayBounds.end];

    if (restaurantFilter) {
      todayOrdersQuery += " AND restaurant_id = ?";
      todayParams.push(restaurantFilter);
    }

    const todayStats = await db()
      .prepare(todayOrdersQuery)
      .bind(...todayParams)
      .first<{
        order_count: number;
        delivered_sales: number;
        delivered_count: number;
        cancelled_count: number;
      }>();

    // 4. Monthly metrics for Selected Month (IST)
    let mRange;
    try {
      mRange = monthRange(monthFilter);
    } catch {
      mRange = monthRange(indiaDate().slice(0, 7));
    }

    let monthlyQuery = `
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'served' AND COALESCE(is_test, 0) = 0 THEN total ELSE 0 END) as delivered_sales,
        SUM(CASE WHEN status = 'served' THEN 1 ELSE 0 END) as delivered_orders
      FROM orders
      WHERE COALESCE(completed_at, created_at) >= ? AND COALESCE(completed_at, created_at) < ?
    `;
    const monthlyParams: unknown[] = [mRange.start, mRange.end];

    if (restaurantFilter) {
      monthlyQuery += " AND restaurant_id = ?";
      monthlyParams.push(restaurantFilter);
    }

    const monthStats = await db()
      .prepare(monthlyQuery)
      .bind(...monthlyParams)
      .first<{
        total_orders: number;
        delivered_sales: number;
        delivered_orders: number;
      }>();

    // 5. Recent audit logs for Super Admin overview
    const recentAudit = await db()
      .prepare(`
        SELECT id, action, actor_email, actor_role, target_type, target_id, details, created_at
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT 10
      `)
      .all();

    return Response.json(
      {
        restaurants: {
          total: restaurantStats?.total || 0,
          active: restaurantStats?.active || 0,
          suspended: (restaurantStats?.suspended || 0) + (restaurantStats?.paused || 0),
        },
        staff: {
          admins: accountStats?.admins || 0,
          waiters: accountStats?.waiters || 0,
          active: accountStats?.active_accounts || 0,
          suspended: accountStats?.suspended_accounts || 0,
        },
        today: {
          date: dateFilter,
          orderCount: todayStats?.order_count || 0,
          deliveredSales: todayStats?.delivered_sales || 0,
          deliveredCount: todayStats?.delivered_count || 0,
          cancelledCount: todayStats?.cancelled_count || 0,
        },
        monthly: {
          month: monthFilter,
          orderCount: monthStats?.total_orders || 0,
          deliveredSales: monthStats?.delivered_sales || 0,
          deliveredCount: monthStats?.delivered_orders || 0,
        },
        recentAudit: recentAudit.results,
        disclaimer: "Delivered-order sales values are based on menu pricing and exclude test orders, pending orders, and cancellations. These do not represent bank settlements or net profit.",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("GET /api/admin/overview error:", err);
    return Response.json({ error: "Failed to load super admin overview stats." }, { status: 503 });
  }
}

import { access, db, validSlug, readMenu } from "@/db/store";
import {
  indiaDate,
  yesterdayIndiaDate,
  dayRange,
  monthRange,
  lastMonth,
  customDateRange,
} from "@/lib/order-time";
import type { Dish, Menu } from "@/lib/menu";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const restaurant = u.searchParams.get("restaurant") || "";
    const period = u.searchParams.get("period") || "today"; // today | yesterday | this_month | last_month | custom
    const startDate = u.searchParams.get("start_date") || "";
    const endDate = u.searchParams.get("end_date") || "";

    const a = await access(restaurant || undefined);
    if (!a.allowed && !a.owner) {
      return Response.json({ error: "Restaurant admin access required." }, { status: 403 });
    }

    // Waiters are strictly forbidden
    if (a.role === "waiter") {
      return Response.json({ error: "Waiters are not permitted to access dish performance reports." }, { status: 403 });
    }

    // Restaurant scope enforcement
    let targetRestaurant = restaurant;
    if (!a.owner) {
      targetRestaurant = a.restaurantId || "";
    }

    if (!targetRestaurant || !validSlug(targetRestaurant)) {
      return Response.json({ error: "Please specify a valid restaurant." }, { status: 400 });
    }

    // 1. Calculate IST date boundaries
    let range: { start: string; end: string; label: string };
    const todayStr = indiaDate();

    try {
      if (period === "yesterday") {
        const yDay = yesterdayIndiaDate();
        const b = dayRange(yDay);
        range = { start: b.start, end: b.end, label: `Yesterday (${yDay})` };
      } else if (period === "this_month") {
        const m = todayStr.slice(0, 7);
        const b = monthRange(m);
        range = { start: b.start, end: b.end, label: `This Month (${m})` };
      } else if (period === "last_month") {
        const lm = lastMonth();
        const b = monthRange(lm);
        range = { start: b.start, end: b.end, label: `Last Month (${lm})` };
      } else if (period === "custom") {
        if (!startDate || !endDate) {
          throw new Error("Start date and end date are required for custom range.");
        }
        const b = customDateRange(startDate, endDate);
        range = { start: b.start, end: b.end, label: b.label };
      } else {
        // default "today"
        const b = dayRange(todayStr);
        range = { start: b.start, end: b.end, label: `Today (${todayStr})` };
      }
    } catch (e: any) {
      return Response.json({ error: e.message || "Invalid date range parameters." }, { status: 400 });
    }

    // 2. Fetch delivered orders within the period (excludes pending, cancelled, and test orders)
    // Attribution: delivery date (completed_at, fallback to updated_at)
    const ordersResult = await db()
      .prepare(`
        SELECT id, items, total, completed_at, updated_at, created_at
        FROM orders
        WHERE restaurant_id = ?
          AND status = 'served'
          AND COALESCE(is_test, 0) = 0
          AND COALESCE(completed_at, updated_at) >= ?
          AND COALESCE(completed_at, updated_at) < ?
        ORDER BY COALESCE(completed_at, updated_at) DESC
      `)
      .bind(targetRestaurant, range.start, range.end)
      .all<{
        id: string;
        items: string;
        total: number;
        completed_at: string | null;
        updated_at: string;
        created_at: string;
      }>();

    // 3. Fetch ratings submitted in the period
    const ratingsResult = await db()
      .prepare(`
        SELECT id, order_id, dish_id, dish_name, rating, comment, created_at
        FROM dish_ratings
        WHERE restaurant_id = ?
          AND created_at >= ?
          AND created_at < ?
        ORDER BY created_at DESC
      `)
      .bind(targetRestaurant, range.start, range.end)
      .all<{
        id: string;
        order_id: string;
        dish_id: string;
        dish_name: string;
        rating: number;
        comment: string;
        created_at: string;
      }>();

    // Also fetch all-time ratings for baseline rating counts
    const allTimeRatings = await db()
      .prepare(`
        SELECT dish_id, ROUND(AVG(rating), 2) as avg_rating, COUNT(*) as count
        FROM dish_ratings
        WHERE restaurant_id = ?
        GROUP BY dish_id
      `)
      .bind(targetRestaurant)
      .all<{ dish_id: string; avg_rating: number; count: number }>();

    const allTimeMap = new Map<string, { avg: number; count: number }>();
    for (const r of allTimeRatings.results) {
      allTimeMap.set(r.dish_id, { avg: Number(r.avg_rating) || 0, count: Number(r.count) || 0 });
    }

    // 4. Fetch current menu to correlate dishes, current availability, and categories
    const menuRow = await readMenu(targetRestaurant);
    const menuDishes: Dish[] = menuRow?.menu?.dishes || [];
    const dishMap = new Map<string, Dish>();
    for (const d of menuDishes) {
      dishMap.set(d.id, d);
    }

    // 5. Aggregate metrics per dish using stable dish IDs
    interface DishMetrics {
      id: string;
      name: string;
      category: string;
      currentlyAvailable: boolean;
      onCurrentMenu: boolean;
      quantitySold: number;
      ordersCount: number;
      salesValue: number; // based on saved order item prices
      periodRatingsCount: number;
      periodRatingSum: number;
      allTimeRatingsCount: number;
      allTimeAvgRating: number;
      comments: Array<{ rating: number; comment: string; date: string }>;
      lastSoldAt: string | null;
    }

    const performanceMap = new Map<string, DishMetrics>();

    // Initialize with all current menu dishes
    for (const d of menuDishes) {
      const at = allTimeMap.get(d.id);
      performanceMap.set(d.id, {
        id: d.id,
        name: d.name,
        category: d.category,
        currentlyAvailable: d.available,
        onCurrentMenu: true,
        quantitySold: 0,
        ordersCount: 0,
        salesValue: 0,
        periodRatingsCount: 0,
        periodRatingSum: 0,
        allTimeRatingsCount: at?.count || 0,
        allTimeAvgRating: at?.avg || 0,
        comments: [],
        lastSoldAt: null,
      });
    }

    // Process delivered orders and items
    for (const order of ordersResult.results) {
      let items: Array<{ id: string; name: string; quantity: number; unitPrice?: number; price?: number }> = [];
      try {
        items = JSON.parse(order.items);
      } catch {
        continue;
      }

      const orderDeliveredAt = order.completed_at || order.updated_at;

      for (const item of items) {
        let entry = performanceMap.get(item.id);
        if (!entry) {
          // Historical dish that was renamed or removed from active menu
          const at = allTimeMap.get(item.id);
          entry = {
            id: item.id,
            name: item.name || "Historical Dish",
            category: "Archived / Unlisted",
            currentlyAvailable: false,
            onCurrentMenu: false,
            quantitySold: 0,
            ordersCount: 0,
            salesValue: 0,
            periodRatingsCount: 0,
            periodRatingSum: 0,
            allTimeRatingsCount: at?.count || 0,
            allTimeAvgRating: at?.avg || 0,
            comments: [],
            lastSoldAt: null,
          };
          performanceMap.set(item.id, entry);
        }

        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.unitPrice ?? item.price) || 0;
        const itemSales = unitPrice * qty;

        entry.quantitySold += qty;
        entry.ordersCount += 1;
        entry.salesValue += itemSales;

        if (!entry.lastSoldAt || orderDeliveredAt > entry.lastSoldAt) {
          entry.lastSoldAt = orderDeliveredAt;
        }
      }
    }

    // Process period ratings
    for (const r of ratingsResult.results) {
      let entry = performanceMap.get(r.dish_id);
      if (!entry) {
        const at = allTimeMap.get(r.dish_id);
        entry = {
          id: r.dish_id,
          name: r.dish_name || "Historical Dish",
          category: "Archived / Unlisted",
          currentlyAvailable: false,
          onCurrentMenu: false,
          quantitySold: 0,
          ordersCount: 0,
          salesValue: 0,
          periodRatingsCount: 0,
          periodRatingSum: 0,
          allTimeRatingsCount: at?.count || 0,
          allTimeAvgRating: at?.avg || 0,
          comments: [],
          lastSoldAt: null,
        };
        performanceMap.set(r.dish_id, entry);
      }

      entry.periodRatingsCount += 1;
      entry.periodRatingSum += r.rating;

      if (r.comment && r.comment.trim()) {
        entry.comments.push({
          rating: r.rating,
          comment: r.comment.trim(),
          date: r.created_at,
        });
      }
    }

    // Format dish rows
    const dishesList = Array.from(performanceMap.values()).map((d) => {
      const periodAvg = d.periodRatingsCount > 0 ? Number((d.periodRatingSum / d.periodRatingsCount).toFixed(2)) : null;
      return {
        id: d.id,
        name: d.name,
        category: d.category,
        currentlyAvailable: d.currentlyAvailable,
        onCurrentMenu: d.onCurrentMenu,
        quantitySold: d.quantitySold,
        ordersCount: d.ordersCount,
        salesValue: d.salesValue,
        periodRatingsCount: d.periodRatingsCount,
        periodAvgRating: periodAvg,
        allTimeRatingsCount: d.allTimeRatingsCount,
        allTimeAvgRating: d.allTimeAvgRating,
        latestComments: d.comments.slice(0, 5),
        lastSoldAt: d.lastSoldAt,
      };
    });

    // 6. Best Sellers, Top Value, Top Rated, and Unsold calculations
    const soldDishes = dishesList.filter((d) => d.quantitySold > 0);

    // Best-selling dish (highest quantity sold)
    let bestSeller: { winners: typeof dishesList; isTie: boolean } | null = null;
    if (soldDishes.length > 0) {
      const maxQty = Math.max(...soldDishes.map((d) => d.quantitySold));
      if (maxQty > 0) {
        const winners = soldDishes.filter((d) => d.quantitySold === maxQty);
        bestSeller = {
          winners,
          isTie: winners.length > 1,
        };
      }
    }

    // Highest-sales-value dish
    let highestValue: { winners: typeof dishesList; isTie: boolean } | null = null;
    if (soldDishes.length > 0) {
      const maxValue = Math.max(...soldDishes.map((d) => d.salesValue));
      if (maxValue > 0) {
        const winners = soldDishes.filter((d) => d.salesValue === maxValue);
        highestValue = {
          winners,
          isTie: winners.length > 1,
        };
      }
    }

    // Highest-rated dish: highest average rating with at least five ratings in the selected period (>= 5)
    let highestRated: { winners: typeof dishesList; isTie: boolean } | null = null;
    const qualifiedRated = dishesList.filter((d) => d.periodRatingsCount >= 5 && d.periodAvgRating !== null);
    if (qualifiedRated.length > 0) {
      const maxRating = Math.max(...qualifiedRated.map((d) => d.periodAvgRating!));
      const winners = qualifiedRated.filter((d) => d.periodAvgRating === maxRating);
      highestRated = {
        winners,
        isTie: winners.length > 1,
      };
    }

    // Unsold dishes: zero delivered sales in the selected period (only active menu dishes)
    const unsoldDishes = dishesList.filter((d) => d.onCurrentMenu && d.quantitySold === 0);
    const unsoldAvailable = unsoldDishes.filter((d) => d.currentlyAvailable);
    const unsoldUnavailable = unsoldDishes.filter((d) => !d.currentlyAvailable);

    // Totals for the period
    const totalDishesSold = dishesList.reduce((s, d) => s + Number(d.quantitySold || 0), 0);
    const totalOrderSalesValue = dishesList.reduce((s, d) => s + Number(d.salesValue || 0), 0);
    const totalDeliveredOrders = Number(ordersResult.results.length || 0);

    return Response.json(
      {
        restaurant: targetRestaurant,
        restaurantName: menuRow?.menu?.name || targetRestaurant,
        period,
        range,
        dishes: dishesList.sort((a, b) => b.quantitySold - a.quantitySold || b.salesValue - a.salesValue),
        summary: {
          totalDeliveredOrders,
          totalQuantitySold: totalDishesSold,
          totalSalesValue: totalOrderSalesValue,
          bestSeller,
          highestValue,
          highestRated,
          unsold: {
            total: unsoldDishes.length,
            availableWithNoSales: unsoldAvailable,
            unavailable: unsoldUnavailable,
            note: "Dishes with zero sales reflect the current period. Availability represents current menu settings; historical availability was not logged prior to today.",
          },
        },
        disclaimer: "Sales values are calculated from historical ordered menu item prices. They reflect customer order value, not verified bank settlements or profit.",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("GET /api/dish-performance error:", err);
    return Response.json({ error: "Failed to generate dish performance report." }, { status: 503 });
  }
}

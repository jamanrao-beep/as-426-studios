import { indiaDate, dayRange } from "@/lib/order-time";
import { access, orderAccess, db, readMenu, sameOrigin, validSlug } from "@/db/store";
import { orderInput, priceOrder, transitions, type OrderStatus } from "@/lib/orders";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

async function hash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, "0")).join("");
}

function receipt(row: any) {
  return {
    id: row.id,
    code: row.id.slice(0, 8).toUpperCase(),
    status: row.status,
    total: row.total,
    table: row.table_label,
    created_at: row.created_at,
  };
}

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return Response.json({ error: "Please order from the restaurant menu." }, { status: 403 });

    const raw = await req.text();
    if (raw.length > 20000) return Response.json({ error: "Order is too large." }, { status: 413 });

    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return Response.json({ error: "Invalid order." }, { status: 400 });
    }

    const extendedSchema = orderInput.extend({
      isTest: z.boolean().optional(),
    });

    const parsed = extendedSchema.safeParse(value);
    if (!parsed.success) {
      return Response.json({ error: "Check your table number and selected quantities." }, { status: 400 });
    }
    const b = parsed.data;

    const requestHash = await hash(JSON.stringify({ ...b, items: [...b.items].sort((a, b) => a.id.localeCompare(b.id)) }));

    const prior = await db()
      .prepare("SELECT id, request_hash, status, total, table_label, created_at FROM orders WHERE id = ?")
      .bind(b.id)
      .first<any>();

    if (prior) {
      if (prior.request_hash !== requestHash) {
        return Response.json({ error: "This order was already submitted with different details." }, { status: 409 });
      }
      return Response.json({ order: receipt(prior) });
    }

    const current = await readMenu(b.restaurant);
    if (!current) return Response.json({ error: "Restaurant unavailable." }, { status: 404 });

    // Check if restaurant is active
    if (!current.menu.active) {
      return Response.json({ error: "This restaurant is not taking orders right now." }, { status: 403 });
    }

    let priced;
    try {
      priced = priceOrder(current.menu, b.items);
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "Please refresh your menu." }, { status: 409 });
    }

    const now = new Date().toISOString();
    const isTestOrder = b.isTest ? 1 : 0;
    const initialStatusHistory = JSON.stringify([{ status: "new", by: "customer", role: "customer", at: now }]);

    const result = await db()
      .prepare(`
        INSERT OR IGNORE INTO orders (
          id, restaurant_id, restaurant_name, table_label, customer_name, notes, items, total,
          status, request_hash, is_test, status_history, created_at, updated_at, tracking_hash
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        b.id,
        b.restaurant,
        current.menu.name,
        b.table,
        b.name,
        b.notes,
        JSON.stringify(priced.lines),
        priced.total,
        requestHash,
        isTestOrder,
        initialStatusHistory,
        now,
        now,
        b.trackingToken ? await hash(b.trackingToken) : null
      )
      .run();

    if (!result.meta.changes) {
      const concurrent = await db()
        .prepare("SELECT id, request_hash, status, total, table_label, created_at FROM orders WHERE id = ?")
        .bind(b.id)
        .first<any>();
      if (concurrent?.request_hash === requestHash) return Response.json({ order: receipt(concurrent) });
      return Response.json({ error: "The menu changed while you ordered. Refresh it and review your cart." }, { status: 409 });
    }

    return Response.json(
      { order: receipt({ id: b.id, status: "new", total: priced.total, table_label: b.table, created_at: now }) },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("POST /api/orders error:", err);
    return Response.json(
      { error: "We couldn’t confirm your order. Retry without changing your cart, or ask your server." },
      { status: 503 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const id = u.searchParams.get("restaurant") || undefined;
    const managerOnly = u.searchParams.get("scope") === "manage";
    const alerts = u.searchParams.get("alerts") === "1";
    const offset = Number(u.searchParams.get("offset") || 0);

    const tableFilter = u.searchParams.get("table")?.trim() || "";
    const statusFilter = u.searchParams.get("status")?.trim() || "";
    const searchFilter = u.searchParams.get("search")?.trim() || "";

    if ((id && !validSlug(id)) || !Number.isSafeInteger(offset) || offset < 0) {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }

    const a = await orderAccess(id, managerOnly);
    if (!a.allowed && !a.owner) {
      return Response.json({ error: "Order access required." }, { status: 403 });
    }

    // Waiter restaurant isolation: cannot query another restaurant
    if (a.role === "waiter") {
      if (id && a.restaurantId && id !== a.restaurantId) {
        return Response.json({ error: "You can only access orders for your assigned restaurant." }, { status: 403 });
      }
    }

    const effectiveRestaurantId = a.role === "waiter" ? a.restaurantId : (id || (a.owner ? undefined : a.restaurantId));

    const params: unknown[] = [];
    let where = "1=1";

    if (effectiveRestaurantId) {
      where += " AND o.restaurant_id = ?";
      params.push(effectiveRestaurantId);
    } else if (!a.owner && a.restaurantIds.length > 0) {
      where += ` AND o.restaurant_id IN (${a.restaurantIds.map(() => "?").join(",")})`;
      params.push(...a.restaurantIds);
    }

    const view = u.searchParams.get("view") || "today";
    const todayIST = indiaDate();
    const todayBounds = dayRange(todayIST);

    if (!alerts) {
      if (view === "unfinished") {
        where += " AND o.status IN ('new','accepted','preparing') AND o.created_at < ?";
        params.push(todayBounds.start);
      } else if (view === "history") {
        const histDate = u.searchParams.get("date")?.trim();
        if (histDate) {
          try {
            const range = dayRange(histDate);
            where += " AND o.created_at >= ? AND o.created_at < ?";
            params.push(range.start, range.end);
          } catch {
            return Response.json({ error: "Invalid date format." }, { status: 400 });
          }
        }
      } else {
        // "today" view
        where += " AND o.created_at >= ? AND o.created_at < ?";
        params.push(todayBounds.start, todayBounds.end);
      }
    }

    if (alerts) {
      where += " AND o.status = 'new'";
    }

    if (statusFilter && ["new", "accepted", "preparing", "served", "cancelled"].includes(statusFilter)) {
      where += " AND o.status = ?";
      params.push(statusFilter);
    }

    if (tableFilter) {
      where += " AND (LOWER(o.table_label) = LOWER(?) OR o.table_label = ?)";
      params.push(tableFilter, tableFilter);
    }

    if (searchFilter) {
      where += " AND (o.id LIKE ? OR LOWER(o.table_label) LIKE ? OR LOWER(o.customer_name) LIKE ?)";
      const pattern = `%${searchFilter.toLowerCase()}%`;
      params.push(pattern, pattern, pattern);
    }

    const result = await db()
      .prepare(`
        SELECT 
          o.id, o.restaurant_id, o.restaurant_name, o.table_label, o.customer_name, o.notes, 
          o.items, o.total, o.status, o.is_test, o.status_history, 
          o.accepted_by, o.accepted_at, o.preparing_by, o.preparing_at,
          o.delivered_by, o.delivered_at, o.completed_by, o.completed_at,
          o.cancelled_by, o.cancelled_by_id, o.cancelled_by_name, o.cancelled_by_role,
          o.cancellation_reason, o.cancelled_at,
          o.created_at, o.updated_at
        FROM orders o 
        WHERE ${where} 
        ORDER BY o.created_at DESC, o.id DESC 
        LIMIT 51 OFFSET ?
      `)
      .bind(...params, offset)
      .all<any>();

    // Compute today's summary counts for current restaurant
    let summary = { new: 0, accepted: 0, preparing: 0, served: 0, cancelled: 0 };
    if (effectiveRestaurantId) {
      try {
        const counts = await db()
          .prepare(`
            SELECT status, COUNT(*) as cnt 
            FROM orders 
            WHERE restaurant_id = ? AND created_at >= ? AND created_at < ?
            GROUP BY status
          `)
          .bind(effectiveRestaurantId, todayBounds.start, todayBounds.end)
          .all<{ status: string; cnt: number }>();

        for (const row of counts.results) {
          if (row.status in summary) {
            (summary as any)[row.status] = Number(row.cnt || 0);
          }
        }
      } catch (cntErr) {
        console.error("Failed to compute order summary counts:", cntErr);
      }
    }

    return Response.json(
      {
        orders: result.results.slice(0, 50).map((r) => ({
          ...r,
          items: typeof r.items === "string" ? JSON.parse(r.items) : r.items,
          status_history: typeof r.status_history === "string" ? JSON.parse(r.status_history) : r.status_history || [],
        })),
        hasMore: result.results.length > 50,
        summary,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("GET /api/orders error:", err);
    return Response.json({ error: "Order feed unavailable. Please retry." }, { status: 503 });
  }
}

export async function PATCH(req: Request) {
  try {
    if (!sameOrigin(req)) return Response.json({ error: "Request rejected." }, { status: 403 });

    const p = z
      .object({
        restaurant: z.string().refine(validSlug),
        id: z.string().min(1).max(100),
        from: z.enum(["new", "accepted", "preparing", "served", "cancelled"]),
        status: z.enum(["new", "accepted", "preparing", "served", "cancelled"]),
        reason: z.string().trim().max(500).optional(),
      })
      .safeParse(await req.json());

    if (!p.success) return Response.json({ error: "Invalid order update." }, { status: 400 });
    const b = p.data;

    // Check authenticated session and order access
    const actor = await orderAccess(b.restaurant);
    if (!actor.allowed && !actor.owner) {
      return Response.json({ error: "Order access required." }, { status: 403 });
    }

    // Role-based restaurant scoping:
    // Waiters and Admins can only update orders for their assigned restaurant
    if (actor.role !== "super_admin" && actor.restaurantId !== b.restaurant) {
      return Response.json(
        { error: "Access denied. You can only update orders for your assigned restaurant." },
        { status: 403 }
      );
    }

    // Fetch existing order to validate current status and prevent conflicting/backwards changes
    const currentOrder = await db()
      .prepare(`
        SELECT id, restaurant_id, status, is_test, status_history, table_label
        FROM orders 
        WHERE id = ?
      `)
      .bind(b.id)
      .first<{
        id: string;
        restaurant_id: string;
        status: OrderStatus;
        is_test?: number;
        status_history?: string;
        table_label: string;
      }>();

    if (!currentOrder) {
      return Response.json({ error: "Order not found." }, { status: 404 });
    }

    if (currentOrder.restaurant_id !== b.restaurant) {
      return Response.json({ error: "Order belongs to a different restaurant." }, { status: 403 });
    }

    // Prevent any changes to already completed or cancelled orders
    if (currentOrder.status === "served") {
      return Response.json({ error: "Delivered orders cannot be modified." }, { status: 400 });
    }

    if (currentOrder.status === "cancelled") {
      return Response.json({ error: "Cancelled orders cannot be reopened or modified." }, { status: 400 });
    }

    // Detect concurrent updates by other staff members
    if (currentOrder.status !== b.from) {
      const statusNames: Record<string, string> = {
        new: "Placed",
        accepted: "Accepted",
        preparing: "Preparing",
        served: "Delivered",
        cancelled: "Cancelled",
      };
      return Response.json(
        {
          error: `This order was already updated to '${statusNames[currentOrder.status] || currentOrder.status}'. Please refresh your order feed.`,
        },
        { status: 409 }
      );
    }

    // Validate permitted transitions:
    // Placed -> Accepted or Cancelled
    // Accepted -> Preparing, Delivered (served) or Cancelled
    // Preparing -> Delivered (served) or Cancelled
    if (!transitions[currentOrder.status].includes(b.status)) {
      return Response.json({ error: "That status transition is not allowed." }, { status: 400 });
    }

    // Cancellation requires a mandatory reason
    if (b.status === "cancelled") {
      if (!b.reason || b.reason.trim().length < 2) {
        return Response.json(
          { error: "A cancellation reason is required and will be shown to the customer." },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();
    const actorName = actor.name || actor.email;
    const actorId = actor.userId || actor.email;
    const actorRole = actor.role || "staff";

    let history: any[] = [];
    if (currentOrder.status_history) {
      try {
        history = JSON.parse(currentOrder.status_history);
      } catch {}
    }

    history.push({
      status: b.status,
      from: currentOrder.status,
      by: actorName,
      byId: actorId,
      role: actorRole,
      reason: b.status === "cancelled" ? b.reason?.trim() : undefined,
      at: now,
    });

    const isAccepted = b.status === "accepted";
    const isPreparing = b.status === "preparing";
    const isServed = b.status === "served";
    const isCancelled = b.status === "cancelled";

    // Atomically execute update with optimistic concurrency guard
    const result = await db()
      .prepare(`
        UPDATE orders 
        SET 
          status = ?, 
          updated_at = ?,
          status_history = ?,
          accepted_by = CASE WHEN ? = 1 THEN ? ELSE accepted_by END,
          accepted_at = CASE WHEN ? = 1 THEN ? ELSE accepted_at END,
          preparing_by = CASE WHEN ? = 1 THEN ? ELSE preparing_by END,
          preparing_at = CASE WHEN ? = 1 THEN ? ELSE preparing_at END,
          delivered_by = CASE WHEN ? = 1 THEN ? ELSE delivered_by END,
          delivered_at = CASE WHEN ? = 1 THEN ? ELSE delivered_at END,
          completed_by = CASE WHEN ? = 1 THEN ? ELSE completed_by END,
          completed_at = CASE WHEN ? = 1 THEN ? ELSE completed_at END,
          cancelled_by = CASE WHEN ? = 1 THEN ? ELSE cancelled_by END,
          cancelled_by_id = CASE WHEN ? = 1 THEN ? ELSE cancelled_by_id END,
          cancelled_by_name = CASE WHEN ? = 1 THEN ? ELSE cancelled_by_name END,
          cancelled_by_role = CASE WHEN ? = 1 THEN ? ELSE cancelled_by_role END,
          cancellation_reason = CASE WHEN ? = 1 THEN ? ELSE cancellation_reason END,
          cancelled_at = CASE WHEN ? = 1 THEN ? ELSE cancelled_at END
        WHERE id = ? AND restaurant_id = ? AND status = ?
      `)
      .bind(
        b.status,
        now,
        JSON.stringify(history),
        isAccepted ? 1 : 0,
        actorName,
        isAccepted ? 1 : 0,
        now,
        isPreparing ? 1 : 0,
        actorName,
        isPreparing ? 1 : 0,
        now,
        isServed ? 1 : 0,
        actorName,
        isServed ? 1 : 0,
        now,
        isServed ? 1 : 0,
        actorName,
        isServed ? 1 : 0,
        now,
        isCancelled ? 1 : 0,
        actorName,
        isCancelled ? 1 : 0,
        actorId,
        isCancelled ? 1 : 0,
        actorName,
        isCancelled ? 1 : 0,
        actorRole,
        isCancelled ? 1 : 0,
        b.reason ? b.reason.trim() : null,
        isCancelled ? 1 : 0,
        now,
        b.id,
        b.restaurant,
        currentOrder.status
      )
      .run();

    if (!result.meta.changes) {
      // Concurrency conflict - another user modified the status simultaneously
      const refreshed = await db()
        .prepare("SELECT status FROM orders WHERE id = ?")
        .bind(b.id)
        .first<{ status: string }>();

      return Response.json(
        {
          error: `Another staff member already updated this order to '${refreshed?.status || "another status"}'. Please refresh.`,
        },
        { status: 409 }
      );
    }

    // Atomic structured audit logging
    await logAudit({
      action: "order_status_changed",
      actorId,
      actorEmail: actor.email,
      actorRole,
      targetType: "order",
      targetId: b.id,
      details: {
        restaurant: b.restaurant,
        from: currentOrder.status,
        to: b.status,
        actorName,
        reason: b.reason ? b.reason.trim() : null,
      },
    });

    return Response.json({ ok: true, status: b.status });
  } catch (err: any) {
    console.error("PATCH /api/orders error:", err);
    return Response.json({ error: "Couldn’t update this order." }, { status: 503 });
  }
}

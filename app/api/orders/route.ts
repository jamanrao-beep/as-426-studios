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

    if ((id && !validSlug(id)) || !Number.isSafeInteger(offset) || offset < 0) {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }

    const a = await orderAccess(id, managerOnly);
    if (!a.allowed && !a.owner) {
      return Response.json({ error: "Order access required." }, { status: 403 });
    }

    const params: unknown[] = [];
    let where = "1=1";

    if (id) {
      where += " AND o.restaurant_id = ?";
      params.push(id);
    } else if (!a.owner && a.restaurantIds.length > 0) {
      where += ` AND o.restaurant_id IN (${a.restaurantIds.map(() => "?").join(",")})`;
      params.push(...a.restaurantIds);
    }

    const view = u.searchParams.get("view") || "today";

    if (!alerts) {
      if (view === "unfinished") {
        where += " AND o.status IN ('new','accepted','preparing') AND o.created_at < ?";
        params.push(dayRange(indiaDate()).start);
      } else {
        let range;
        try {
          range = dayRange(view === "history" ? u.searchParams.get("date") || indiaDate() : indiaDate());
        } catch {
          return Response.json({ error: "Invalid date." }, { status: 400 });
        }
        where += " AND o.created_at >= ? AND o.created_at < ?";
        params.push(range.start, range.end);
      }
    }

    if (alerts) {
      where += " AND o.status = 'new'";
    }

    const result = await db()
      .prepare(`
        SELECT 
          o.id, o.restaurant_id, o.restaurant_name, o.table_label, o.customer_name, o.notes, 
          o.items, o.total, o.status, o.is_test, o.status_history, o.accepted_by, o.delivered_by,
          o.created_at, o.updated_at, o.completed_at, o.completed_by 
        FROM orders o 
        WHERE ${where} 
        ORDER BY o.created_at DESC, o.id DESC 
        LIMIT 51 OFFSET ?
      `)
      .bind(...params, offset)
      .all<any>();

    return Response.json(
      {
        orders: result.results.slice(0, 50).map((r) => ({
          ...r,
          items: typeof r.items === "string" ? JSON.parse(r.items) : r.items,
          status_history: typeof r.status_history === "string" ? JSON.parse(r.status_history) : r.status_history || [],
        })),
        hasMore: result.results.length > 50,
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
      })
      .safeParse(await req.json());

    if (!p.success) return Response.json({ error: "Invalid order update." }, { status: 400 });
    const b = p.data;

    // Check order access for user
    const actor = await orderAccess(b.restaurant);
    if (!actor.allowed && !actor.owner) {
      return Response.json({ error: "Order access required." }, { status: 403 });
    }

    // Role-based permission enforcement:
    // Waiters can ONLY mark orders as delivered ('served'). They CANNOT accept or cancel!
    if (actor.role === "waiter") {
      if (b.status !== "served") {
        return Response.json(
          { error: "Waiters are only permitted to confirm delivery. Accepting or cancelling orders requires manager authorization." },
          { status: 403 }
        );
      }
      if (b.from !== "accepted" && b.from !== "preparing") {
        return Response.json(
          { error: "Delivery can only be confirmed for accepted or preparing orders." },
          { status: 400 }
        );
      }
    }

    if (!transitions[b.from as OrderStatus].includes(b.status)) {
      return Response.json({ error: "That status change is not allowed." }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Fetch existing status history
    const existing = await db().prepare("SELECT status_history FROM orders WHERE id = ?").bind(b.id).first<{ status_history?: string }>();
    let history: any[] = [];
    if (existing?.status_history) {
      try {
        history = JSON.parse(existing.status_history);
      } catch {}
    }
    history.push({
      status: b.status,
      by: actor.email,
      role: actor.role || "staff",
      at: now,
    });

    const isServed = b.status === "served";
    const isCancelled = b.status === "cancelled";
    const isAccepted = b.status === "accepted";
    const isPreparing = b.status === "preparing";

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
          cancelled_at = CASE WHEN ? = 1 THEN ? ELSE cancelled_at END
        WHERE id = ? AND restaurant_id = ? AND status = ?
      `)
      .bind(
        b.status,
        now,
        JSON.stringify(history),
        isAccepted ? 1 : 0,
        actor.email,
        isAccepted ? 1 : 0,
        now,
        isPreparing ? 1 : 0,
        actor.email,
        isPreparing ? 1 : 0,
        now,
        isServed ? 1 : 0,
        actor.email,
        isServed ? 1 : 0,
        now,
        isServed ? 1 : 0,
        actor.email,
        isServed ? 1 : 0,
        now,
        isCancelled ? 1 : 0,
        actor.email,
        isCancelled ? 1 : 0,
        now,
        b.id,
        b.restaurant,
        b.from
      )
      .run();

    if (!result.meta.changes) {
      return Response.json({ error: "This order changed or is unavailable. Refresh the orders list." }, { status: 409 });
    }

    await logAudit({
      action: "order_status_changed",
      actorEmail: actor.email,
      actorRole: actor.role || "staff",
      targetType: "order",
      targetId: b.id,
      details: { from: b.from, to: b.status, restaurant: b.restaurant },
    });

    return Response.json({ ok: true, status: b.status });
  } catch (err: any) {
    console.error("PATCH /api/orders error:", err);
    return Response.json({ error: "Couldn’t update this order." }, { status: 503 });
  }
}

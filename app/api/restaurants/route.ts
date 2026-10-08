import { access, db, sameOrigin, validSlug, readMenu } from "@/db/store";
import { sample } from "@/lib/menu";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

export async function GET(req: Request) {
  try {
    const admin = new URL(req.url).searchParams.get("admin") === "1";
    if (!admin) {
      return Response.json({ error: "Restaurant directory is not available to customers." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }

    const a = await access();
    if (!a.allowed && !a.owner) {
      return Response.json({ error: "Restaurant access required." }, { status: 403 });
    }

    // Load from restaurants table
    const dbRestaurants = await db()
      .prepare("SELECT id, name, slug, address, contact_phone, contact_email, welcome_message, note, status, manager_qr_visible, created_at, updated_at FROM restaurants WHERE status != 'archived'")
      .all<{
        id: string;
        name: string;
        slug: string;
        address: string;
        contact_phone: string;
        contact_email: string;
        welcome_message: string;
        note: string;
        status: string;
        manager_qr_visible?: number;
        created_at: string;
        updated_at: string;
      }>();

    // Load menu counts
    const menuResult = await db().prepare("SELECT id, data FROM menu").all<{ id: string; data: string }>();
    const menuMap = new Map<string, { count: number; active: boolean; deleted: boolean }>();
    for (const m of menuResult.results) {
      try {
        const parsed = JSON.parse(m.data);
        menuMap.set(m.id, {
          count: parsed.dishes?.length || 0,
          active: parsed.active !== false,
          deleted: !!parsed.deleted,
        });
      } catch {}
    }

    let rows = dbRestaurants.results.map((r) => {
      const mInfo = menuMap.get(r.id);
      return {
        ...r,
        count: mInfo?.count || 0,
        active: r.status === "active" && (mInfo ? mInfo.active : true),
        manager_qr_visible: r.manager_qr_visible !== 0,
      };
    });

    // Ensure ember-spice exists in results
    if (!rows.some((r) => r.id === "ember-spice")) {
      rows.unshift({
        id: "ember-spice",
        name: "Ember & Spice",
        slug: "ember-spice",
        address: "42 Connaught Place, New Delhi",
        contact_phone: "+91 98100 12345",
        contact_email: "contact@emberspice.com",
        welcome_message: "Welcome to Ember & Spice.",
        note: "Taxes and service charge included.",
        status: "active",
        manager_qr_visible: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        count: sample.dishes.length,
        active: true,
      });
    }

    // Role-based filtering: Super Admin sees all; Restaurant Admin sees ONLY their assigned restaurant
    if (!a.owner) {
      rows = rows.filter((r) => a.restaurantIds.includes(r.id));
    }

    return Response.json({ restaurants: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error("GET /api/restaurants error:", err);
    return Response.json({ error: "Couldn’t load restaurants." }, { status: 503 });
  }
}

const addRestaurantSchema = z.object({
  id: z.string().refine(validSlug),
  name: z.string().trim().min(1).max(70),
  address: z.string().trim().max(150).optional(),
  contact_phone: z.string().trim().max(40).optional(),
  contact_email: z.string().trim().email().max(100).optional(),
  welcome_message: z.string().trim().max(300).optional(),
  note: z.string().trim().max(300).optional(),
});

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return Response.json({ error: "Request rejected." }, { status: 403 });

    const a = await access();
    if (!a.owner) {
      return Response.json({ error: "Super Admin access required to create restaurants." }, { status: 403 });
    }

    const raw = await req.json();
    const parsed = addRestaurantSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ error: "Please enter a valid restaurant name and unique URL slug." }, { status: 400 });
    }

    const { id, name, address, contact_phone, contact_email, welcome_message, note } = parsed.data;
    const now = new Date().toISOString();

    // Check if ID is in use
    const existing = await db().prepare("SELECT id FROM restaurants WHERE id = ?").bind(id).first();
    if (existing) {
      return Response.json({ error: "That restaurant URL slug is already in use. Choose another." }, { status: 409 });
    }

    // 1. Insert into restaurants table
    await db()
      .prepare(`
        INSERT INTO restaurants (id, name, slug, address, contact_phone, contact_email, welcome_message, note, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
      `)
      .bind(
        id,
        name,
        id,
        address || "",
        contact_phone || "",
        contact_email || "",
        welcome_message || `Welcome to ${name}.`,
        note || "Please tell your server about any allergies.",
        now,
        now
      )
      .run();

    // 2. Initialize menu table
    const initialMenu = {
      name,
      active: true,
      tagline: welcome_message || "Welcome to our table.",
      note: note || "Please tell your server about any allergies.",
      dishes: [],
    };
    await db()
      .prepare("INSERT OR REPLACE INTO menu (id, data, revision) VALUES (?, ?, 1)")
      .bind(id, JSON.stringify(initialMenu))
      .run();

    await logAudit({
      action: "restaurant_created",
      actorEmail: a.email,
      actorRole: "super_admin",
      targetType: "restaurant",
      targetId: id,
      details: { name, slug: id },
    });

    return Response.json({
      ok: true,
      id,
      name,
      menu: initialMenu,
      revision: 1,
    });
  } catch (err: any) {
    console.error("POST /api/restaurants error:", err);
    return Response.json({ error: err?.message || "Couldn’t create the restaurant. Please try again." }, { status: 503 });
  }
}

const updateRestaurantSchema = z.object({
  id: z.string().refine(validSlug),
  name: z.string().trim().min(1).max(70).optional(),
  address: z.string().trim().max(150).optional(),
  contact_phone: z.string().trim().max(40).optional(),
  contact_email: z.string().trim().email().max(100).optional(),
  welcome_message: z.string().trim().max(300).optional(),
  note: z.string().trim().max(300).optional(),
  status: z.enum(["active", "paused", "suspended"]).optional(),
  manager_qr_visible: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    if (!sameOrigin(req)) return Response.json({ error: "Request rejected." }, { status: 403 });

    const raw = await req.json();
    const parsed = updateRestaurantSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ error: "Invalid restaurant update payload." }, { status: 400 });
    }

    const { id, name, address, contact_phone, contact_email, welcome_message, note, status, manager_qr_visible } = parsed.data;
    const a = await access(id);

    if (!a.allowed && !a.owner) {
      return Response.json({ error: "Restaurant manager access required." }, { status: 403 });
    }

    const now = new Date().toISOString();

    // If Restaurant Admin (not Super Admin), only allow permitted fields: welcome_message, note, status (pause/resume)
    if (!a.owner) {
      if (status && status === "suspended") {
        return Response.json({ error: "Only Super Admin can suspend restaurants." }, { status: 403 });
      }
      if (manager_qr_visible !== undefined) {
        return Response.json({ error: "Only Super Admin can control manager QR code visibility." }, { status: 403 });
      }
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (a.owner && name) {
      updates.push("name = ?");
      params.push(name);
    }
    if (a.owner && address !== undefined) {
      updates.push("address = ?");
      params.push(address);
    }
    if (a.owner && contact_phone !== undefined) {
      updates.push("contact_phone = ?");
      params.push(contact_phone);
    }
    if (a.owner && contact_email !== undefined) {
      updates.push("contact_email = ?");
      params.push(contact_email);
    }
    if (a.owner && manager_qr_visible !== undefined) {
      updates.push("manager_qr_visible = ?");
      params.push(manager_qr_visible ? 1 : 0);
    }
    if (welcome_message !== undefined) {
      updates.push("welcome_message = ?");
      params.push(welcome_message);
    }
    if (note !== undefined) {
      updates.push("note = ?");
      params.push(note);
    }
    if (status !== undefined) {
      updates.push("status = ?");
      params.push(status);
    }

    if (updates.length > 0) {
      updates.push("updated_at = ?");
      params.push(now);
      params.push(id);

      await db()
        .prepare(`UPDATE restaurants SET ${updates.join(", ")} WHERE id = ?`)
        .bind(...params)
        .run();

      // Synchronize menu active state if status changed
      if (status !== undefined) {
        const currentMenu = await readMenu(id);
        if (currentMenu) {
          const updated = {
            ...currentMenu.menu,
            active: status === "active",
          };
          await db()
            .prepare("UPDATE menu SET data = ?, revision = revision + 1 WHERE id = ?")
            .bind(JSON.stringify(updated), id)
            .run();
        }
      }

      await logAudit({
        action: "restaurant_updated",
        actorEmail: a.email,
        actorRole: a.role,
        targetType: "restaurant",
        targetId: id,
        details: { status, welcome_message, note, manager_qr_visible },
      });
    }

    return Response.json({ ok: true });
  } catch (err: any) {
    console.error("PATCH /api/restaurants error:", err);
    return Response.json({ error: err?.message || "Failed to update restaurant." }, { status: 503 });
  }
}

export async function DELETE(req: Request) {
  try {
    if (!sameOrigin(req)) return Response.json({ error: "Request rejected." }, { status: 403 });

    const a = await access();
    if (!a.owner) {
      return Response.json({ error: "Only Super Admin can archive a restaurant." }, { status: 403 });
    }

    const b = (await req.json()) as { id?: unknown; confirmation?: unknown };
    if (typeof b.id !== "string" || !validSlug(b.id) || typeof b.confirmation !== "string") {
      return Response.json({ error: "Invalid archiving request." }, { status: 400 });
    }

    const restRow = await db().prepare("SELECT id, name FROM restaurants WHERE id = ?").bind(b.id).first<{ id: string; name: string }>();
    if (!restRow) {
      return Response.json({ error: "Restaurant not found." }, { status: 404 });
    }

    if (b.confirmation.trim().toLowerCase() !== restRow.name.trim().toLowerCase()) {
      return Response.json({ error: "Type the restaurant name exactly to confirm archiving." }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Archive the restaurant: mark status as archived (preserves historical orders and sales!)
    await db()
      .prepare("UPDATE restaurants SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?")
      .bind(now, now, b.id)
      .run();

    // Mark menu as deleted/unavailable so customer page shows "Restaurant unavailable"
    const marker = JSON.stringify({ deleted: true, archived: true, name: restRow.name });
    await db()
      .prepare("UPDATE menu SET data = ?, revision = revision + 1 WHERE id = ?")
      .bind(marker, b.id)
      .run();

    await logAudit({
      action: "restaurant_archived",
      actorEmail: a.email,
      actorRole: "super_admin",
      targetType: "restaurant",
      targetId: b.id,
      details: { name: restRow.name },
    });

    return Response.json({ ok: true, message: `Restaurant ${restRow.name} archived.` });
  } catch (err: any) {
    console.error("DELETE /api/restaurants error:", err);
    return Response.json({ error: "Couldn’t archive the restaurant. Please try again." }, { status: 503 });
  }
}

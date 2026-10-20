import { NextResponse } from "next/server";
import { z } from "zod";
import { access, db, sameOrigin, validSlug } from "@/db/store";
import { logAudit } from "@/lib/audit";
import {
  ensureControlsTables,
  mergeGlobal,
  mergeRestaurant,
  readGlobalControls,
  readRestaurantControls,
  writeScope,
} from "@/lib/app-controls";
import { sendPush } from "@/lib/push-server";

export const dynamic = "force-dynamic";

// Super Admin only: everything the mobile app is allowed to do.
export async function GET() {
  try {
    const a = await access();
    if (!a.owner) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    await ensureControlsTables();
    const restaurants = await db()
      .prepare("SELECT id, name FROM restaurants WHERE status != 'archived' ORDER BY name")
      .all<{ id: string; name: string }>();
    const list = await Promise.all(
      restaurants.results.map(async (r) => {
        const devices = await db()
          .prepare("SELECT COUNT(*) AS n FROM push_tokens WHERE restaurant_id = ?")
          .bind(r.id)
          .first<{ n: number }>();
        return { id: r.id, name: r.name, controls: await readRestaurantControls(r.id), devices: Number(devices?.n || 0) };
      })
    );
    return NextResponse.json({ global: await readGlobalControls(), restaurants: list }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/app-controls error:", err);
    return NextResponse.json({ error: "Could not load app controls." }, { status: 503 });
  }
}

const putSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("global"), data: z.any() }),
  z.object({ scope: z.literal("restaurant"), restaurant: z.string().refine(validSlug), data: z.any() }),
]);

export async function PUT(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const a = await access();
    if (!a.owner) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const p = putSchema.safeParse(await req.json());
    if (!p.success) return NextResponse.json({ error: "Invalid settings." }, { status: 400 });

    if (p.data.scope === "global") {
      const data = mergeGlobal(p.data.data);
      if (data.announcement.text.length > 500 || data.announcement.title.length > 80 || data.maintenance.message.length > 300) {
        return NextResponse.json({ error: "Text is too long." }, { status: 400 });
      }
      // A new id makes the app show the announcement again to people who dismissed an older one.
      const previous = await readGlobalControls();
      if (data.announcement.on && (data.announcement.text !== previous.announcement.text || data.announcement.title !== previous.announcement.title || !data.announcement.id)) {
        data.announcement.id = String(Date.now());
      }
      await writeScope("global", data, a.email);
      await logAudit({ action: "app_controls_updated", actorEmail: a.email, actorRole: a.role, targetType: "app", targetId: "global" });
      return NextResponse.json({ global: data });
    }

    const exists = await db().prepare("SELECT id FROM restaurants WHERE id = ?").bind(p.data.restaurant).first();
    if (!exists) return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
    const data = mergeRestaurant(p.data.data);
    await writeScope(`restaurant:${p.data.restaurant}`, data, a.email);
    await logAudit({ action: "app_controls_updated", actorEmail: a.email, actorRole: a.role, targetType: "restaurant", targetId: p.data.restaurant });
    return NextResponse.json({ restaurant: p.data.restaurant, controls: data });
  } catch (err) {
    console.error("PUT /api/app-controls error:", err);
    return NextResponse.json({ error: "Could not save app controls." }, { status: 503 });
  }
}

const sendSchema = z.object({
  restaurant: z.string().refine(validSlug).optional(),
  roles: z.array(z.enum(["admin", "waiter"])).min(1).default(["admin", "waiter"]),
  title: z.string().trim().min(1).max(60),
  body: z.string().trim().min(1).max(200),
});

// Super Admin sends a notification to the phones of one restaurant, or everyone.
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const a = await access();
    if (!a.owner) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const p = sendSchema.safeParse(await req.json());
    if (!p.success) return NextResponse.json({ error: "Enter a title and a short message." }, { status: 400 });
    const result = await sendPush({ restaurantId: p.data.restaurant, roles: p.data.roles }, p.data.title, p.data.body, { type: "broadcast" });
    await logAudit({
      action: "app_notification_sent",
      actorEmail: a.email,
      actorRole: a.role,
      targetType: "restaurant",
      targetId: p.data.restaurant || "all",
      details: { title: p.data.title, sent: result.sent },
    });
    return NextResponse.json({ sent: result.sent });
  } catch (err) {
    console.error("POST /api/app-controls error:", err);
    return NextResponse.json({ error: "Could not send the notification." }, { status: 503 });
  }
}

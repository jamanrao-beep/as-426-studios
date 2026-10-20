import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { db, sameOrigin } from "@/db/store";
import { ensureControlsTables } from "@/lib/app-controls";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(10).max(190).regex(/^Expo(nent)?PushToken\[.+\]$/),
  platform: z.enum(["ios", "android"]).optional(),
});

// A phone registers itself so the server can send it order and table-request alerts.
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    if (user.role === "super_admin") return NextResponse.json({ ok: true });
    const p = schema.safeParse(await req.json());
    if (!p.success) return NextResponse.json({ error: "Invalid push token." }, { status: 400 });

    await ensureControlsTables();
    const now = new Date().toISOString();
    const existing = await db().prepare("SELECT token FROM push_tokens WHERE token = ?").bind(p.data.token).first();
    if (existing) {
      await db()
        .prepare("UPDATE push_tokens SET user_email = ?, role = ?, restaurant_id = ?, platform = ?, updated_at = ? WHERE token = ?")
        .bind(user.email.toLowerCase(), user.role, user.restaurantId || null, p.data.platform || null, now, p.data.token)
        .run();
    } else {
      await db()
        .prepare("INSERT INTO push_tokens (token, user_email, role, restaurant_id, platform, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(p.data.token, user.email.toLowerCase(), user.role, user.restaurantId || null, p.data.platform || null, now)
        .run();
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/push-tokens error:", err);
    return NextResponse.json({ error: "Could not register this device." }, { status: 503 });
  }
}

// Sign-out: stop alerts to this phone.
export async function DELETE(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const p = z.object({ token: z.string().min(10).max(190) }).safeParse(await req.json());
    if (!p.success) return NextResponse.json({ error: "Invalid push token." }, { status: 400 });
    await ensureControlsTables();
    await db().prepare("DELETE FROM push_tokens WHERE token = ? AND LOWER(user_email) = ?").bind(p.data.token, user.email.toLowerCase()).run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/push-tokens error:", err);
    return NextResponse.json({ error: "Could not update this device." }, { status: 503 });
  }
}

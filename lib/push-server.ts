import { db } from "@/db/store";
import { ensureControlsTables, readRestaurantControls } from "@/lib/app-controls";

type Target = { restaurantId?: string; roles?: Array<"admin" | "waiter">; emails?: string[] };

// Sends a push notification through Expo's push service to every matching device.
export async function sendPush(target: Target, title: string, body: string, data: Record<string, unknown> = {}) {
  try {
    await ensureControlsTables();
    const where: string[] = [];
    const params: unknown[] = [];
    if (target.restaurantId) {
      where.push("restaurant_id = ?");
      params.push(target.restaurantId);
    }
    if (target.roles?.length) {
      where.push(`role IN (${target.roles.map(() => "?").join(",")})`);
      params.push(...target.roles);
    }
    if (target.emails?.length) {
      where.push(`LOWER(user_email) IN (${target.emails.map(() => "?").join(",")})`);
      params.push(...target.emails.map((e) => e.toLowerCase()));
    }
    const rows = await db()
      .prepare(`SELECT token FROM push_tokens ${where.length ? "WHERE " + where.join(" AND ") : ""} LIMIT 500`)
      .bind(...params)
      .all<{ token: string }>();
    const tokens = rows.results.map((r) => r.token).filter((t) => /^Expo(nent)?PushToken\[/.test(t));
    if (!tokens.length) return { sent: 0 };

    let sent = 0;
    for (let i = 0; i < tokens.length; i += 100) {
      const batch = tokens.slice(i, i + 100);
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(
          batch.map((to) => ({ to, title, body, data, sound: "default", priority: "high", channelId: "orders" }))
        ),
        signal: AbortSignal.timeout(4000),
      });
      const json = (await res.json().catch(() => null)) as { data?: Array<{ status: string; details?: { error?: string } }> } | null;
      json?.data?.forEach(async (t, idx) => {
        if (t.status === "ok") sent++;
        else if (t.details?.error === "DeviceNotRegistered") {
          await db().prepare("DELETE FROM push_tokens WHERE token = ?").bind(batch[idx]).run().catch(() => {});
        }
      });
    }
    return { sent };
  } catch (err) {
    console.error("sendPush failed:", err);
    return { sent: 0 };
  }
}

// Alert the staff of one restaurant, unless the Super Admin turned push off for it.
export async function notifyRestaurantStaff(
  restaurantId: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
) {
  try {
    const controls = await readRestaurantControls(restaurantId);
    if (!controls.appEnabled || !controls.pushEnabled) return { sent: 0 };
  } catch {
    return { sent: 0 };
  }
  return sendPush({ restaurantId, roles: ["admin", "waiter"] }, title, body, data);
}

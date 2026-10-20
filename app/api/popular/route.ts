import { db, validSlug } from "@/db/store";

export const dynamic = "force-dynamic";

// Public: which dishes are ordered most at this restaurant over the last 14 days.
export async function GET(req: Request) {
  try {
    const restaurant = new URL(req.url).searchParams.get("restaurant") || "";
    if (!validSlug(restaurant)) return Response.json({ error: "Invalid restaurant" }, { status: 400 });
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await db()
      .prepare("SELECT items FROM orders WHERE restaurant_id = ? AND status != 'cancelled' AND created_at >= ? ORDER BY created_at DESC LIMIT 1000")
      .bind(restaurant, since)
      .all<{ items: string }>();
    const qty = new Map<string, number>();
    for (const r of rows.results) {
      try {
        for (const i of JSON.parse(r.items) as Array<{ id: string; quantity: number }>) {
          qty.set(i.id, (qty.get(i.id) || 0) + (Number(i.quantity) || 0));
        }
      } catch {}
    }
    const popular = [...qty.entries()]
      .filter(([, q]) => q >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);
    return Response.json({ popular }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return Response.json({ error: "Unavailable" }, { status: 503 });
  }
}

import { readMenu, validSlug } from "@/db/store";

export const dynamic = "force-dynamic";

// Serves one dish photo as a real image so browsers can cache it, instead of
// re-downloading every photo each time the menu refreshes.
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const restaurant = u.searchParams.get("restaurant") || "";
    const dish = u.searchParams.get("dish") || "";
    if (!validSlug(restaurant) || !dish) return new Response("Not found", { status: 404 });
    const result = await readMenu(restaurant);
    if (!result || !result.menu.active) return new Response("Not found", { status: 404 });
    const image = result.menu.dishes.find((d: { id: string; image?: string }) => d.id === dish)?.image;
    const m = image && /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image);
    if (!m) return new Response("Not found", { status: 404 });
    return new Response(Buffer.from(m[2], "base64"), {
      headers: {
        "Content-Type": m[1],
        // The ?v= value in the URL changes whenever the photo changes.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Unavailable", { status: 503 });
  }
}

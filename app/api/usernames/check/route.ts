import { NextResponse } from "next/server";
import { access, denied, validSlug } from "@/db/store";
import { ensureSaasTables } from "@/lib/saas";
import { checkUsernameAt, staffLogin } from "@/lib/usernames";

export const dynamic = "force-dynamic";

// A manager (or the Super Admin) typing a new person's username asks: is it free at this restaurant? Two people at
// one restaurant cannot share a username; people at different restaurants can.
export async function GET(req: Request) {
  try {
    const a = await access();
    if (!a.owner && !(a.allowed && a.restaurantId)) return denied(a, "Restaurant manager or Super Admin access required.");
    const u = new URL(req.url);
    const code = a.owner ? u.searchParams.get("restaurant") || "" : a.restaurantId!;
    if (!validSlug(code)) return NextResponse.json({ error: "Choose a restaurant first." }, { status: 400 });
    await ensureSaasTables();
    const username = (u.searchParams.get("username") || "").trim().toLowerCase();
    const r = await checkUsernameAt(username, code);
    return NextResponse.json(r.ok ? { available: true, login: staffLogin(username, code), restaurantCode: code } : { available: false, reason: r.reason }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/usernames/check error:", err);
    return NextResponse.json({ error: "Could not check that name." }, { status: 503 });
  }
}

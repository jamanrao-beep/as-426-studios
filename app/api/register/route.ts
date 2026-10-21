import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { db, sameOrigin } from "@/db/store";
import { hashPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { ensureSaasTables } from "@/lib/saas";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(190),
  password: z.string().min(6).max(100),
  ownerName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(40),
  restaurantName: z.string().trim().min(2).max(120),
  address: z.string().trim().min(5).max(300),
  city: z.string().trim().min(2).max(80),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
});

// A restaurant owner asks to join. The Super Admin reviews it on the website.
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = String(issue?.path?.[0] || "details");
      return NextResponse.json({ error: `Please check ${field === "email" ? "your email address" : field}.` }, { status: 400 });
    }
    const d = parsed.data;

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`register:${ip}`, 5, 60 * 60 * 1000).allowed) {
      return NextResponse.json({ error: "Too many requests from this device. Please try again later." }, { status: 429 });
    }

    await ensureSaasTables();
    const account = await db().prepare("SELECT id FROM accounts WHERE LOWER(email) = ?").bind(d.email).first();
    if (account) return NextResponse.json({ error: "An account with this email already exists. Please sign in." }, { status: 409 });
    const pending = await db().prepare("SELECT id FROM registration_requests WHERE email = ? AND status = 'pending'").bind(d.email).first();
    if (pending) return NextResponse.json({ error: "A request for this email is already waiting for review." }, { status: 409 });

    await db()
      .prepare(
        `INSERT INTO registration_requests
         (id, email, password_hash, owner_name, phone, restaurant_name, address, city, lat, lng, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
      )
      .bind(
        "req_" + crypto.randomBytes(8).toString("hex"),
        d.email,
        await hashPassword(d.password),
        d.ownerName,
        d.phone,
        d.restaurantName,
        d.address,
        d.city,
        d.lat ?? null,
        d.lng ?? null,
        new Date().toISOString()
      )
      .run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/register error:", err);
    return NextResponse.json({ error: "Could not send your request. Please try again." }, { status: 503 });
  }
}

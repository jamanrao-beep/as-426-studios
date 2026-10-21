import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { db, sameOrigin } from "@/db/store";
import { hashPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { ensureSaasTables, getPlan, LOGIN_DOMAIN } from "@/lib/saas";
import { rateLimitDb } from "@/lib/rate-limit-db";

export const dynamic = "force-dynamic";

const schema = z.object({
  contactEmail: z.string().trim().toLowerCase().email().max(190),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9._-]{2,29}$/),
  planChoice: z.string().trim().min(2).max(16).default("trial"),
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
      const label: Record<string, string> = {
        contactEmail: "your email address",
        username: "your login name (3 to 30 letters, numbers, dots or dashes)",
        password: "your password (at least 6 characters)",
        ownerName: "your name",
        phone: "your phone number",
        restaurantName: "the restaurant name",
        address: "the street address",
        city: "the city",
      };
      return NextResponse.json({ error: `Please check ${label[field] || field}.` }, { status: 400 });
    }
    const d = parsed.data;
    const RESERVED = new Set(["admin", "administrator", "root", "support", "help", "info", "owner", "manager", "staff", "waiter", "tablesecret", "table-secret", "as426", "as426studios", "superadmin", "super-admin", "system", "noreply", "no-reply", "postmaster", "security", "billing", "sales", "team", "official"]);
    if (RESERVED.has(d.username)) {
      return NextResponse.json({ error: "That login name is reserved. Please choose another." }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await rateLimitDb(`register:${ip}`, 5, 60 * 60 * 1000)).allowed) {
      return NextResponse.json({ error: "Too many requests from this device. Please try again later." }, { status: 429 });
    }

    await ensureSaasTables();
    if (d.planChoice !== "trial") {
      const wanted = await getPlan(d.planChoice);
      if (!wanted || !wanted.active) return NextResponse.json({ error: "That plan is not available. Please pick another." }, { status: 400 });
    }
    const loginEmail = `${d.username}@${LOGIN_DOMAIN}`;
    const account = await db().prepare("SELECT id FROM accounts WHERE LOWER(email) = ?").bind(loginEmail).first();
    if (account) return NextResponse.json({ error: `The login ${loginEmail} is already taken. Try another name.` }, { status: 409 });
    const pending = await db()
      .prepare("SELECT id FROM registration_requests WHERE (email = ? OR contact_email = ?) AND status = 'pending'")
      .bind(loginEmail, d.contactEmail)
      .first();
    if (pending) return NextResponse.json({ error: "A request for this login or email is already waiting for review." }, { status: 409 });

    const id = "req_" + crypto.randomBytes(8).toString("hex");
    await db()
      .prepare(
        `INSERT INTO registration_requests
         (id, email, password_hash, owner_name, phone, restaurant_name, address, city, lat, lng, status, created_at, contact_email, plan_choice)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
      )
      .bind(
        id,
        loginEmail,
        await hashPassword(d.password),
        d.ownerName,
        d.phone,
        d.restaurantName,
        d.address,
        d.city,
        d.lat ?? null,
        d.lng ?? null,
        new Date().toISOString(),
        d.contactEmail,
        d.planChoice
      )
      .run();

    return NextResponse.json({ ok: true, loginEmail, id });
  } catch (err) {
    console.error("POST /api/register error:", err);
    return NextResponse.json({ error: "Could not send your request. Please try again." }, { status: 503 });
  }
}

// The applicant's live status. The request id is a random secret only they hold, and only the status comes back.
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!/^req_[a-f0-9]{16}$/.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`regstatus:${ip}`, 120, 60 * 60 * 1000).allowed) return NextResponse.json({ error: "Too many checks." }, { status: 429 });
    await ensureSaasTables();
    const r = await db()
      .prepare("SELECT status, restaurant_name, email, note FROM registration_requests WHERE id = ?")
      .bind(id)
      .first<{ status: string; restaurant_name: string; email: string; note: string | null }>();
    if (!r) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const status = r.status === "approved" ? "approved" : r.status === "rejected" ? "rejected" : "pending";
    return NextResponse.json(
      { status, restaurantName: r.restaurant_name, loginEmail: r.email, note: status === "rejected" ? r.note : null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/register error:", err);
    return NextResponse.json({ error: "Could not check the status." }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, getAuthUser } from "@/lib/auth";
import { db, sameOrigin } from "@/db/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const returnTo = url.searchParams.get("return_to") || "/login";
  const redirectUrl = new URL(returnTo.startsWith("/") ? returnTo : "/login", url.origin);

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}

export async function POST(req: Request) {
  // "Sign out of all devices": moving the session version on makes every token for this account stop working.
  try {
    if (sameOrigin(req)) {
      const body = (await req.json().catch(() => ({}))) as { everywhere?: boolean };
      if (body && body.everywhere === true) {
        const user = await getAuthUser();
        if (user) {
          await db().prepare("UPDATE accounts SET session_version = session_version + 1, updated_at = ? WHERE LOWER(email) = ?").bind(new Date().toISOString(), user.email.toLowerCase()).run();
        }
      }
    }
  } catch (e) {
    console.error("logout everywhere failed", e);
  }
  const response = NextResponse.json({ success: true, message: "Logged out successfully" });
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}

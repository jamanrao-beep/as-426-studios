import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const returnTo = url.searchParams.get("return_to") || "/login";
  const redirectUrl = new URL(returnTo.startsWith("/") ? returnTo : "/login", url.origin);

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}

export async function POST(req: Request) {
  const response = NextResponse.json({ success: true, message: "Logged out successfully" });
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}

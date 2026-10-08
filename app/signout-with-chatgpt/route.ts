import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const returnTo = url.searchParams.get("return_to") || "/login";
  const targetUrl = new URL(`/login?return_to=${encodeURIComponent(returnTo)}`, url.origin);
  const response = NextResponse.redirect(targetUrl);
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}

import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const returnTo = url.searchParams.get("return_to") || "/team";
  const loginUrl = new URL(`/login?return_to=${encodeURIComponent(returnTo)}`, url.origin);
  return NextResponse.redirect(loginUrl);
}

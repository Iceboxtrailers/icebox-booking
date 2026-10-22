import { NextResponse } from "next/server";
import { clearedAdminSessionCookie } from "@/lib/admin-session";

// Ends the console session only: a booking session in the same browser is left alone.
export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearedAdminSessionCookie(new URL(request.url).protocol === "https:"));
  return response;
}

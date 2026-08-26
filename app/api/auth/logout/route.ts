import { NextRequest, NextResponse } from "next/server";
import { deleteSession, SESSION_COOKIE } from "@/lib/userAuth";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    // Actually revoke the session server-side, not just clear the cookie —
    // otherwise a copied/leaked cookie would still work after "logout".
    await deleteSession(token);
  }
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

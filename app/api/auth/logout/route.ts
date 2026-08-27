import { NextResponse } from "next/server";
import { deleteSession, SESSION_COOKIE } from "@/lib/userAuth";
import { cookies } from "next/headers";

/**
 * POST /api/auth/logout
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    if (token) {
      await deleteSession(token);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (err) {
    console.error("[Logout] Error:", err);
    return NextResponse.json({ success: true });
  }
}

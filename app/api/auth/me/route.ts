import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/userAuth";

/**
 * GET /api/auth/me
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json({ user });
  } catch (err) {
    console.error("[Me] Error:", err);
    return NextResponse.json({ user: null });
  }
}

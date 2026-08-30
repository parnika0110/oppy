import { NextRequest, NextResponse } from "next/server";
import { resetPasswordWithCode } from "@/lib/userAuth";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

/**
 * POST /api/auth/reset-password
 *
 * Verifies the reset code and sets a new password.
 * The code must be valid, unused, and not expired (15 min TTL).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, password } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }
    if (!code || typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
      return NextResponse.json(
        { error: "Reset code is required." },
        { status: 400 }
      );
    }
    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "New password is required." },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    // Rate limit: max 5 attempts per 15 minutes per IP
    const rlKey = getRateLimitKey(request, "reset-password");
    const rl = checkRateLimit(rlKey, 5, 15 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const success = await resetPasswordWithCode(email, code, password);

    if (!success) {
      return NextResponse.json(
        { error: "Invalid or expired reset code. Please request a new one." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: "Password reset successful. You can now log in with your new password.",
    });
  } catch (err) {
    console.error("[Reset Password] Error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

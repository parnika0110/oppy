import { NextRequest, NextResponse } from "next/server";
import { generateResetCode } from "@/lib/userAuth";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

/**
 * POST /api/auth/forgot-password
 *
 * Generates a 6-digit reset code and sends it to the user's email
 * via EmailJS (transactional email).
 *
 * Always returns 200 to prevent email enumeration — the response
 * is identical whether the email exists or not.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    // Rate limit: max 5 requests per 15 minutes per IP
    const rlKey = getRateLimitKey(request, "forgot-password");
    const rl = checkRateLimit(rlKey, 5, 15 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Generate code — returns null for non-existent users (no code, no email)
    const code = await generateResetCode(email);

    if (code) {
      // User exists and code was generated — send it via email
      const emailSent = await sendPasswordResetEmail(email.trim(), code);
      if (!emailSent) {
        console.error(`[Forgot Password] Email delivery failed for ${email.trim()}`);
      }
    }
    // If code is null, user doesn't exist — no email sent.
    // But we still return the same response to prevent enumeration.

    // Always return the same response to prevent email enumeration
    return NextResponse.json({
      message: "If an account exists with that email, a reset code has been sent.",
    });
  } catch (err) {
    console.error("[Forgot Password] Error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

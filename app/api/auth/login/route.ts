import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createSession, SESSION_COOKIE } from "@/lib/userAuth";
import { getUsersCollection, ensureUserIndexes } from "@/lib/mongodb";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

/**
 * POST /api/auth/login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    // Rate limit: max 10 login attempts per 15 minutes per IP
    const rlKey = getRateLimitKey(request, "login");
    const rl = checkRateLimit(rlKey, 10, 15 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }

    await ensureUserIndexes();
    const users = await getUsersCollection();
    const user = await users.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const token = await createSession(user._id);

    const response = NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        onboardingComplete: Boolean(user.onboardingComplete),
        preferences: user.preferences || {},
        createdAt: user.createdAt.toISOString(),
      },
    });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (err) {
    console.error("[Login] Error:", err);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { validateSignupInput, hashPassword, createSession, SESSION_COOKIE } from "@/lib/userAuth";
import { getUsersCollection, ensureUserIndexes } from "@/lib/mongodb";

/**
 * POST /api/auth/signup
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    const error = validateSignupInput(email, password, name);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    await ensureUserIndexes();
    const users = await getUsersCollection();

    const existing = await users.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const now = new Date();

    const result = await users.insertOne({
      email: email.trim().toLowerCase(),
      passwordHash,
      name: name.trim(),
      onboardingComplete: false,
      preferences: {},
      createdAt: now,
      updatedAt: now,
    });

    const token = await createSession(result.insertedId);

    const response = NextResponse.json({
      user: {
        id: result.insertedId.toString(),
        email: email.trim().toLowerCase(),
        name: name.trim(),
        onboardingComplete: false,
        preferences: {},
        createdAt: now.toISOString(),
      },
    });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (err) {
    console.error("[Signup] Error:", err);
    return NextResponse.json({ error: "Signup failed." }, { status: 500 });
  }
}

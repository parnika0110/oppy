import { NextRequest, NextResponse } from "next/server";
import { getUsersCollection, ensureUserIndexes } from "@/lib/mongodb";
import {
  validateSignupInput,
  hashPassword,
  createSession,
  toSafeUser,
  SESSION_COOKIE,
  UserDocument,
} from "@/lib/userAuth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body || {};

    const validationError = validateSignupInput(email, password, name);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    await ensureUserIndexes();
    const users = await getUsersCollection();

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await users.findOne({ email: normalizedEmail });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const now = new Date();

    const doc: Omit<UserDocument, "_id"> = {
      email: normalizedEmail,
      passwordHash,
      name: String(name).trim(),
      onboardingComplete: false,
      preferences: {},
      createdAt: now,
      updatedAt: now,
    };

    const result = await users.insertOne(doc as any);
    const token = await createSession(result.insertedId);

    const response = NextResponse.json({
      user: toSafeUser({ ...(doc as any), _id: result.insertedId }),
    });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    // Handle unique-index race (two signups with same email at once)
    if (error && typeof error === "object" && "code" in error && (error as any).code === 11000) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    console.error("[Auth] Signup failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

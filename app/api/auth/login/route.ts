import { NextRequest, NextResponse } from "next/server";
import { getUsersCollection } from "@/lib/mongodb";
import { verifyPassword, createSession, toSafeUser, SESSION_COOKIE, UserDocument } from "@/lib/userAuth";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = (await request.json()) || {};

    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const users = await getUsersCollection();
    const normalizedEmail = email.trim().toLowerCase();
    const user = (await users.findOne({ email: normalizedEmail })) as unknown as UserDocument | null;

    // Deliberately identical error for "no such user" and "wrong password"
    // so login can't be used to enumerate registered emails.
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const token = await createSession(user._id);

    const response = NextResponse.json({ user: toSafeUser(user) });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    console.error("[Auth] Login failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

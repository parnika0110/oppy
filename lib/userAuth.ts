import crypto from "crypto";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getUsersCollection, getSessionsCollection, ensureUserIndexes } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const SESSION_COOKIE = "oppy_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const BCRYPT_ROUNDS = 12;

export interface UserDocument {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  onboardingComplete?: boolean;
  preferences?: {
    skills?: string[];
    interests?: string[];
    experience?: "Beginner" | "Intermediate" | "Advanced" | null;
    categories?: string[];
    locations?: string[];
    remote?: boolean | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  onboardingComplete: boolean;
  preferences: NonNullable<UserDocument["preferences"]>;
  createdAt: string;
}

function toSafeUser(doc: UserDocument): SafeUser {
  return {
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    onboardingComplete: Boolean(doc.onboardingComplete),
    preferences: doc.preferences || {},
    createdAt: doc.createdAt.toISOString(),
  };
}

// ── Validation ───────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignupInput(email: unknown, password: unknown, name: unknown): string | null {
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return "Enter a valid email address.";
  }
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (typeof name !== "string" || name.trim().length < 1) {
    return "Enter your name.";
  }
  return null;
}

// ── Password hashing ────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── Session management (DB-backed, not stateless) ──────────────────────
// Unlike the admin session (which is HMAC-signed and stateless), user
// sessions are stored server-side in the `sessions` collection so they can
// be revoked (logout) and enumerated/expired via a TTL index, per PHASE 18.

export async function createSession(userId: ObjectId): Promise<string> {
  await ensureUserIndexes();
  const sessions = await getSessionsCollection();
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  await sessions.insertOne({
    token,
    userId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  });
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  const sessions = await getSessionsCollection();
  await sessions.deleteOne({ token });
}

/** Resolve the current request's authenticated user, or null. */
export async function getCurrentUser(request?: NextRequest | Request): Promise<SafeUser | null> {
  let token: string | undefined;

  if (request) {
    // Parse cookie header directly for Route Handlers given a Request
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
    token = match?.[1];
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get(SESSION_COOKIE)?.value;
  }

  if (!token) return null;

  const sessions = await getSessionsCollection();
  const session = await sessions.findOne({ token });
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await sessions.deleteOne({ token });
    return null;
  }

  const users = await getUsersCollection();
  const user = await users.findOne({ _id: session.userId });
  if (!user) return null;

  return toSafeUser(user as unknown as UserDocument);
}

export { toSafeUser };

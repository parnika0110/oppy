import crypto from "crypto";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getUsersCollection, getSessionsCollection, ensureUserIndexes } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const SESSION_COOKIE = "oppy_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const BCRYPT_ROUNDS = 12;

export interface ResumeProfile {
  uploaded: boolean;
  extractedSkills: string[];
  extractedInterests: string[];
  projects: Array<{
    title: string;
    technologies: string[];
    description?: string;
  }>;
  experience: Array<{
    role: string;
    organization: string;
    duration?: string;
    description?: string;
  }>;
  education: Array<{
    institution: string;
    degree?: string;
    field?: string;
    year?: string;
  }>;
  achievements: string[];
  domains: string[];
  parsedAt: Date;
}

export interface UserDocument {
  _id: ObjectId;
  email: string;
  passwordHash?: string; // optional for Google-only users
  name: string;
  avatar?: string;
  onboardingComplete?: boolean;
  preferences?: {
    skills?: string[];
    interests?: string[];
    experience?: "Beginner" | "Intermediate" | "Advanced" | null;
    categories?: string[];
    locations?: string[];
    remote?: boolean | null;
  };
  resumeProfile?: ResumeProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  onboardingComplete: boolean;
  preferences: NonNullable<UserDocument["preferences"]>;
  resumeProfile?: ResumeProfile;
  createdAt: string;
}

function toSafeUser(doc: UserDocument): SafeUser {
  return {
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    avatar: doc.avatar,
    onboardingComplete: Boolean(doc.onboardingComplete),
    preferences: doc.preferences || {},
    resumeProfile: doc.resumeProfile,
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

// ── Password Reset ──────────────────────────────────────────────────────

import { getPasswordResetsCollection } from "@/lib/mongodb";

const RESET_CODE_TTL_MS = 1000 * 60 * 15; // 15 minutes

export interface PasswordResetDocument {
  email: string;
  code: string; // 6-digit numeric code
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
}

/**
 * Generate a 6-digit numeric reset code and store it in the DB.
 * Returns the code (to be sent to the user via email in production).
 */
export async function generateResetCode(email: string): Promise<string | null> {
  const users = await getUsersCollection();
  const user = await users.findOne({ email: email.trim().toLowerCase() });

  // Return null for non-existent users (no code stored, no email sent)
  // but the API layer returns the same 200 response either way,
  // so the caller cannot distinguish between existing and non-existing emails.
  if (!user) return null;

  const code = String(crypto.randomInt(100000, 1000000)); // 6-digit cryptographically secure code
  const now = new Date();
  const resets = await getPasswordResetsCollection();

  // Invalidate any previous unused codes for this email
  await resets.updateMany(
    { email: user.email, used: false },
    { $set: { used: true } }
  );

  await resets.insertOne({
    email: user.email,
    code,
    createdAt: now,
    expiresAt: new Date(now.getTime() + RESET_CODE_TTL_MS),
    used: false,
  });

  return code;
}

/**
 * Verify a reset code for the given email.
 * Returns true if valid, false otherwise.
 */
export async function verifyResetCode(email: string, code: string): Promise<boolean> {
  const resets = await getPasswordResetsCollection();
  const record = await resets.findOne({
    email: email.trim().toLowerCase(),
    code: code.trim(),
    used: false,
    expiresAt: { $gt: new Date() },
  });

  return !!record;
}

/**
 * Reset a user's password using a verified reset code.
 * Marks the code as used to prevent reuse.
 * Returns true on success, false if the code is invalid/expired.
 */
export async function resetPasswordWithCode(
  email: string,
  code: string,
  newPassword: string
): Promise<boolean> {
  const resets = await getPasswordResetsCollection();
  const record = await resets.findOne({
    email: email.trim().toLowerCase(),
    code: code.trim(),
    used: false,
    expiresAt: { $gt: new Date() },
  });

  if (!record) return false;

  // Hash the new password
  const passwordHash = await hashPassword(newPassword);
  const users = await getUsersCollection();
  const result = await users.updateOne(
    { email: email.trim().toLowerCase() },
    { $set: { passwordHash, updatedAt: new Date() } }
  );

  if (result.matchedCount === 0) return false;

  // Mark code as used
  await resets.updateOne(
    { _id: record._id },
    { $set: { used: true } }
  );

  return true;
}

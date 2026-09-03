import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, deleteSession, SESSION_COOKIE } from "@/lib/userAuth";
import {
  getUsersCollection,
  getSessionsCollection,
  getSavedOpportunitiesCollection,
  getApplicationTrackingCollection,
  getPasswordResetsCollection,
  getReminderLogCollection,
} from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * POST /api/account/delete
 * Permanently deletes the authenticated user's account and all associated data.
 *
 * Requires:
 * - Authenticated session
 * - Body: { confirm: "DELETE" }
 *
 * Deleted (user-owned):
 * - user document (users collection)
 * - all sessions (sessions collection)
 * - saved opportunities (savedOpportunities collection)
 * - application tracking (applicationTracking collection)
 * - password resets (passwordResets collection)
 * - reminder logs (reminderLog collection)
 *
 * NOT deleted:
 * - global opportunity records
 * - ingestion runs
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.confirm !== "DELETE") {
      return NextResponse.json(
        { error: "Type DELETE to confirm account deletion." },
        { status: 400 }
      );
    }

    const userId = new ObjectId(user.id);

    // Gather all collection references
    const users = await getUsersCollection();
    const sessions = await getSessionsCollection();
    const saved = await getSavedOpportunitiesCollection();
    const tracking = await getApplicationTrackingCollection();
    const resets = await getPasswordResetsCollection();
    const reminders = await getReminderLogCollection();

    // Delete all user-owned data atomically (best effort)
    // Order matters: delete dependent data first, then user record
    await Promise.all([
      sessions.deleteMany({ userId }),
      saved.deleteMany({ userId }),
      tracking.deleteMany({ userId }),
      resets.deleteMany({ userId }),
      reminders.deleteMany({ userId }),
    ]);

    // Delete the user document itself
    const result = await users.deleteOne({ _id: userId });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Account not found." },
        { status: 404 }
      );
    }

    // Invalidate the current session cookie
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
    console.error("[Account Delete] Error:", err);
    return NextResponse.json(
      { error: "Failed to delete account." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/userAuth";
import { getUsersCollection } from "@/lib/mongodb";

/**
 * GET /api/profile
 * PATCH /api/profile
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    return NextResponse.json({
      profile: {
        name: user.name,
        email: user.email,
      },
      preferences: user.preferences || {},
    });
  } catch (err) {
    console.error("[Profile] Error:", err);
    return NextResponse.json({ profile: null, preferences: null });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const users = await getUsersCollection();

    const update: Record<string, any> = { updatedAt: new Date() };

    if (body.name !== undefined) update.name = body.name;
    if (body.avatar !== undefined) update.avatar = body.avatar;
    if (body.experience_level !== undefined || body.experience !== undefined) {
      update["preferences.experience"] = body.experience_level || body.experience;
    }
    if (body.categories !== undefined) update["preferences.categories"] = body.categories;
    if (body.interests !== undefined) update["preferences.interests"] = body.interests;
    if (body.locations !== undefined) update["preferences.locations"] = body.locations;
    if (body.remote !== undefined) update["preferences.remote"] = body.remote;
    if (body.skills !== undefined) update["preferences.skills"] = body.skills;
    // Accept resume profile updates
    if (body.resumeProfile !== undefined) update.resumeProfile = body.resumeProfile;
    // Accept both camelCase (from frontend) and snake_case (legacy)
    const onboardingFlag = body.onboardingComplete ?? body.onboarding_complete;
    if (onboardingFlag !== undefined) update.onboardingComplete = Boolean(onboardingFlag);

    await users.updateOne({ _id: new (await import("mongodb")).ObjectId(user.id) }, { $set: update });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Profile] Error:", err);
    return NextResponse.json({ error: "Failed to update." }, { status: 500 });
  }
}

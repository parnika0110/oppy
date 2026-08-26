import { NextRequest, NextResponse } from "next/server";
import { getUsersCollection } from "@/lib/mongodb";
import { getCurrentUser, toSafeUser, UserDocument } from "@/lib/userAuth";
import { ObjectId } from "mongodb";

const VALID_EXPERIENCE = ["Beginner", "Intermediate", "Advanced"];

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json();
    const update: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.name === "string" && body.name.trim()) {
      update.name = body.name.trim();
    }
    if (typeof body.onboardingComplete === "boolean") {
      update.onboardingComplete = body.onboardingComplete;
    }

    const prefs: Record<string, unknown> = {};
    if (Array.isArray(body.skills)) prefs.skills = body.skills.filter((s: unknown) => typeof s === "string").slice(0, 20);
    if (Array.isArray(body.interests)) prefs.interests = body.interests.filter((s: unknown) => typeof s === "string").slice(0, 20);
    if (Array.isArray(body.categories)) prefs.categories = body.categories.filter((s: unknown) => typeof s === "string").slice(0, 10);
    if (Array.isArray(body.locations)) prefs.locations = body.locations.filter((s: unknown) => typeof s === "string").slice(0, 10);
    if (typeof body.remote === "boolean") prefs.remote = body.remote;
    if (typeof body.experience === "string" && VALID_EXPERIENCE.includes(body.experience)) {
      prefs.experience = body.experience;
    }

    if (Object.keys(prefs).length > 0) {
      for (const [key, value] of Object.entries(prefs)) {
        update[`preferences.${key}`] = value;
      }
    }

    const users = await getUsersCollection();
    await users.updateOne({ _id: new ObjectId(user.id) }, { $set: update });

    const updated = (await users.findOne({ _id: new ObjectId(user.id) })) as unknown as UserDocument;
    return NextResponse.json({ user: toSafeUser(updated) });
  } catch (error) {
    console.error("[Profile] Update failed:", error);
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}

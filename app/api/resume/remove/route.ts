import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/userAuth";
import { getUsersCollection } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * DELETE /api/resume/remove
 * Removes the stored resumeProfile from the user document.
 * Does NOT affect manually selected preferences.
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const users = await getUsersCollection();
    await users.updateOne(
      { _id: new ObjectId(user.id) },
      {
        $unset: { resumeProfile: "" },
        $set: { updatedAt: new Date() },
      }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Resume Remove] Error:", err);
    return NextResponse.json({ error: "Failed to remove resume." }, { status: 500 });
  }
}

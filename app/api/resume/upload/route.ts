import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/userAuth";
import { getUsersCollection } from "@/lib/mongodb";
import { parseResume } from "@/lib/resume-parser";
import { ObjectId } from "mongodb";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

/**
 * POST /api/resume/upload
 * Accepts a PDF or DOCX resume, parses it, and stores the extracted profile.
 * Never stores the raw resume file — only structured extraction results.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("resume") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a PDF or DOCX file." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse the resume
    const resumeProfile = await parseResume(buffer, file.type);

    // Store only structured data — never store the raw file
    const users = await getUsersCollection();
    await users.updateOne(
      { _id: new ObjectId(user.id) },
      {
        $set: {
          resumeProfile,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      resumeProfile: {
        extractedSkills: resumeProfile.extractedSkills,
        extractedInterests: resumeProfile.extractedInterests,
        projects: resumeProfile.projects,
        experience: resumeProfile.experience,
        education: resumeProfile.education,
        achievements: resumeProfile.achievements,
        domains: resumeProfile.domains,
      },
    });
  } catch (err) {
    console.error("[Resume Upload] Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to parse resume.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

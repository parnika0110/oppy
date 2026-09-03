import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, SESSION_COOKIE } from "@/lib/userAuth";
import { getUsersCollection, getSessionsCollection } from "@/lib/mongodb";
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
    // ── Safe diagnostic: never log cookie values or secrets ──────────
    const cookieHeader = request.headers.get("cookie") || "";
    const hasCookie = cookieHeader.includes(`${SESSION_COOKIE}=`);
    const ct = request.headers.get("content-type") || "";
    console.log(`[Resume Upload] hasCookie=${hasCookie}, content-type=${ct.substring(0, 60)}`);

    const user = await getCurrentUser(request);
    if (!user) {
      // Trace which step failed — safe: no secrets logged
      let failure = "unknown";
      if (!hasCookie) {
        failure = "no_cookie_in_request";
      } else {
        // Token was in cookie but session lookup or user lookup failed
        const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
        const token = match?.[1];
        if (!token) {
          failure = "token_parse_error";
        } else {
          const sessions = await getSessionsCollection();
          const session = await sessions.findOne({ token });
          if (!session) failure = "session_not_found_in_db";
          else if (new Date(session.expiresAt).getTime() < Date.now()) failure = "session_expired";
          else {
            const users = await getUsersCollection();
            const u = await users.findOne({ _id: session.userId });
            failure = u ? "user_found_but_getCurrentUser_failed" : "user_not_found_in_db";
          }
        }
      }
      console.error(`[Resume Upload] 401 — failure: ${failure}`);
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

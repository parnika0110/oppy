import { NextRequest, NextResponse } from "next/server";
import { getOpportunitiesCollection } from "@/lib/mongodb";
import { enrichOpportunity } from "@/lib/openai";
import { CreateOpportunityInput, CATEGORIES } from "@/types/opportunity";
import { isAdminRequest } from "@/lib/auth";

/**
 * No user auth in the MVP. This route is protected by a single shared
 * secret (ADMIN_SECRET) sent as a Bearer token — sufficient since only
 * the founder (you) is calling it to manually curate the dataset.
 */
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body: CreateOpportunityInput = await request.json();

    // --- Validation ---
    const requiredFields: (keyof CreateOpportunityInput)[] = [
      "title",
      "organization",
      "category",
      "location",
      "description",
      "applicationLink",
    ];
    const missing = requiredFields.filter((f) => !body[f]);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }
    if (!CATEGORIES.includes(body.category)) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }
    const deadlineDate = body.deadline ? new Date(body.deadline) : null;
    if (deadlineDate && isNaN(deadlineDate.getTime())) {
      return NextResponse.json({ error: "Invalid deadline date." }, { status: 400 });
    }

    // --- AI enrichment (summary, eligibility, tags, category validation) ---
    // Runs once here, at ingestion time. Cached into the document below.
    // If OpenAI fails, we still save the opportunity — aiSummary stays null
    // and can be backfilled later, rather than blocking data entry.
    let aiSummary = null;
    let categoryValidation = null;
    try {
      const enrichment = await enrichOpportunity({
        title: body.title,
        organization: body.organization,
        category: body.category,
        description: body.description,
        location: body.location,
      });
      aiSummary = enrichment.aiSummary;
      categoryValidation = enrichment.categoryValidation;
    } catch (aiError) {
      console.error("AI enrichment failed, saving without it:", aiError);
    }

    const now = new Date();
    const doc = {
      title: body.title,
      organization: body.organization,
      category: body.category,
      location: body.location,
      tags: body.tags && body.tags.length > 0 ? body.tags : aiSummary?.suggestedTags ?? [],
      description: body.description,
      applicationLink: body.applicationLink,
      imageUrl: body.imageUrl || null,
      deadline: deadlineDate,
      deadlineKind: deadlineDate ? body.deadlineKind || "source_provided" : "unavailable",
      deadlineLastVerifiedAt: deadlineDate ? now : null,
      source: body.source || null,
      aiSummary,
      categoryValidation,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const collection = await getOpportunitiesCollection();
    const result = await collection.insertOne(doc);

    return NextResponse.json(
      {
        item: { ...doc, _id: result.insertedId },
        flaggedCategoryMismatch: categoryValidation && !categoryValidation.isConsistent,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/admin/opportunities failed:", error);
    return NextResponse.json(
      { error: "Failed to create opportunity." },
      { status: 500 }
    );
  }
}

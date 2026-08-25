import OpenAI from "openai";
import { AISummary, Category, CategoryValidation, CATEGORIES } from "@/types/opportunity";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = "gpt-4o-mini"; // cheap + fast, sufficient for structured extraction

interface EnrichmentInput {
  title: string;
  organization: string;
  category: Category;
  description: string;
  location: string;
}

interface EnrichmentResult {
  aiSummary: AISummary;
  categoryValidation: CategoryValidation;
}

/**
 * Single OpenAI call at ingestion time that produces everything the admin
 * flow needs: summary, eligibility, key dates, takeaways, suggested tags,
 * and a category-consistency check.
 *
 * This is intentionally called ONCE per opportunity, at creation time,
 * and the result is cached in MongoDB. The public read path never calls
 * OpenAI, so cost is bounded by dataset size, not traffic.
 */
export async function enrichOpportunity(
  input: EnrichmentInput
): Promise<EnrichmentResult> {
  const systemPrompt = `You are an assistant that helps a student opportunity-discovery platform process listings (internships, hackathons, fellowships, scholarships, events).

Given the raw details of one opportunity, respond with ONLY a JSON object (no markdown fences, no preamble) matching exactly this shape:

{
  "summary": string,                // 2-3 sentence plain-language summary
  "eligibility": string[],          // short bullet points, e.g. "Open to undergraduates" — empty array if not stated
  "keyDates": string[],             // short bullet points of important dates besides the deadline, e.g. "Results announced March 1" — empty array if none found
  "takeaways": string[],            // 2-4 short bullet points on why a student should care / what's notable
  "suggestedTags": string[],        // 1-5 tags from this exact set only: ["AI","Web Development","Open Source","Research","Design","Data Science","Cybersecurity","Product Management"] — pick only tags clearly relevant, can be empty
  "categoryValidation": {
    "isConsistent": boolean,        // true if the given category matches what the description actually describes
    "suggestedCategory": string|null, // one of ["Internship","Hackathon","Fellowship","Scholarship","Event"] if isConsistent is false, else null
    "reasoning": string              // one short sentence explaining the validation result
  }
}

Be concise. Do not invent facts not present or reasonably implied by the description.`;

  const userPrompt = `Title: ${input.title}
Organization: ${input.organization}
Given Category: ${input.category}
Location: ${input.location}
Description:
${input.description}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI returned an empty response during enrichment.");
  }

  const parsed = JSON.parse(raw);

  // Defensive validation — never trust the model's output shape blindly.
  const suggestedCategory: Category | null =
    parsed.categoryValidation?.suggestedCategory &&
    CATEGORIES.includes(parsed.categoryValidation.suggestedCategory)
      ? parsed.categoryValidation.suggestedCategory
      : null;

  const categoryValidation: CategoryValidation = {
    isConsistent: Boolean(parsed.categoryValidation?.isConsistent ?? true),
    suggestedCategory,
    reasoning: parsed.categoryValidation?.reasoning ?? "",
  };

  const aiSummary: AISummary = {
    summary: parsed.summary ?? "",
    eligibility: Array.isArray(parsed.eligibility) ? parsed.eligibility : [],
    keyDates: Array.isArray(parsed.keyDates) ? parsed.keyDates : [],
    takeaways: Array.isArray(parsed.takeaways) ? parsed.takeaways : [],
    suggestedTags: Array.isArray(parsed.suggestedTags) ? parsed.suggestedTags : [],
    generatedAt: new Date().toISOString(),
  };

  return { aiSummary, categoryValidation };
}

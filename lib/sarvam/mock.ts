/**
 * Sarvam AI Mock Module
 *
 * Deterministic responses for development and testing.
 * When SARVAM_MOCK=true, the AI interpret endpoint uses these fixtures
 * instead of calling the real Sarvam API.
 *
 * This preserves API credits during development and CI.
 */

import { parseSearchQuery } from "@/lib/search-intent";

export interface MockPreferences {
  category?: string[];
  interests?: string[];
  remote?: boolean;
  location?: string;
  experience?: string;
}

interface MockFixture {
  input: string;
  output: MockPreferences;
}

const MOCK_FIXTURES: MockFixture[] = [
  // ── English queries ──────────────────────────────────────────
  {
    input: "I want remote AI internships for students in India",
    output: {
      category: ["Internship"],
      interests: ["AI / ML"],
      remote: true,
      location: "India",
      experience: "Student",
    },
  },
  {
    input: "Find software engineering jobs in India",
    output: {
      category: ["Job"],
      interests: ["Software Engineering"],
      location: "India",
    },
  },
  {
    input: "I want AI and web development hackathons in India",
    output: {
      category: ["Hackathon"],
      interests: ["AI / ML", "Web Development"],
      location: "India",
    },
  },
  {
    input: "I want data science internships",
    output: {
      category: ["Internship"],
      interests: ["Data Science"],
    },
  },
  {
    input: "I want marketing internships",
    output: {
      category: ["Internship"],
    },
  },
  {
    input: "I want remote frontend internships",
    output: {
      category: ["Internship"],
      interests: ["Web Development"],
      remote: true,
    },
  },
  {
    input: "Show me fellowships for recent graduates",
    output: {
      category: ["Fellowship"],
      experience: "Recent Graduate",
    },
  },
  {
    input: "I want open source internships",
    output: {
      category: ["Internship"],
      interests: ["Open Source"],
    },
  },
  {
    input: "I want cybersecurity jobs",
    output: {
      category: ["Job"],
      interests: ["Cybersecurity"],
    },
  },
  {
    input: "I want design internships in Bengaluru",
    output: {
      category: ["Internship"],
      interests: ["Design"],
      location: "Bengaluru",
    },
  },
  {
    input: "I want remote software engineering jobs",
    output: {
      category: ["Job"],
      interests: ["Software Engineering"],
      remote: true,
    },
  },
  // ── Hindi/Hinglish queries ───────────────────────────────────
  {
    input: "Bharat mein remote AI internships chahiye",
    output: {
      category: ["Internship"],
      interests: ["AI / ML"],
      remote: true,
      location: "India",
    },
  },
  {
    input: "Mujhe India mein remote software internships chahiye",
    output: {
      category: ["Internship"],
      interests: ["Software Engineering"],
      remote: true,
      location: "India",
    },
  },
];

/**
 * Get a mock interpretation for a given input message.
 * Performs case-insensitive substring matching against known fixtures.
 */
export function getMockInterpretation(message: string): MockPreferences | null {
  const lower = message.toLowerCase();

  // Try exact match first
  for (const fixture of MOCK_FIXTURES) {
    if (fixture.input.toLowerCase() === lower) {
      return fixture.output;
    }
  }

  // Try substring match (check if the input contains any fixture's key phrases)
  for (const fixture of MOCK_FIXTURES) {
    const fixtureLower = fixture.input.toLowerCase();
    // Check if significant words overlap
    const inputWords = new Set(lower.split(/\s+/).filter((w: string) => w.length > 3));
    const fixtureWords = new Set(fixtureLower.split(/\s+/).filter((w: string) => w.length > 3));
    const overlap = [...inputWords].filter(w => fixtureWords.has(w));
    if (overlap.length >= 3) {
      return fixture.output;
    }
  }

  // Fallback: deterministic keyword extraction (shared with the browse quick search)
  const intent = parseSearchQuery(message);
  const preferences: MockPreferences = {};
  if (intent.categories?.length) preferences.category = intent.categories;
  if (intent.interests?.length) preferences.interests = intent.interests;
  if (intent.remote) preferences.remote = true;
  if (intent.location) preferences.location = intent.location;
  if (intent.experience) preferences.experience = intent.experience;

  // Only return if we found something meaningful
  if (Object.keys(preferences).length === 0) return null;
  return preferences;
}

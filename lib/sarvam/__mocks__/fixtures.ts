/**
 * Sarvam AI Mock Fixtures
 *
 * Deterministic responses for testing the preference interpretation
 * pipeline without making real API calls.
 *
 * Use these in Vitest to test:
 * - URL construction
 * - Preference parsing
 * - Filtering
 * - Relevance ranking
 * - Match tiers
 * - Result rendering
 */

export interface SarvamMockFixture {
  input: string;
  expected: {
    categories?: string[];
    interests?: string[];
    location?: string | null;
    remote?: boolean | null;
    experience?: string | null;
  };
}

/**
 * English query fixtures
 */
export const ENGLISH_FIXTURES: SarvamMockFixture[] = [
  {
    input: "I want remote AI internships for students in India",
    expected: {
      categories: ["Internship"],
      interests: ["AI / ML"],
      remote: true,
      location: "India",
      experience: "Student",
    },
  },
  {
    input: "Find software engineering jobs in India",
    expected: {
      categories: ["Job"],
      interests: ["Software Engineering"],
      location: "India",
    },
  },
  {
    input: "I want AI and web development hackathons in India",
    expected: {
      categories: ["Hackathon"],
      interests: ["AI / ML", "Web Development"],
      location: "India",
    },
  },
  {
    input: "I want data science internships",
    expected: {
      categories: ["Internship"],
      interests: ["Data Science"],
    },
  },
  {
    input: "I want marketing internships",
    expected: {
      categories: ["Internship"],
      interests: ["Marketing"],
    },
  },
  {
    input: "I want remote frontend internships",
    expected: {
      categories: ["Internship"],
      interests: ["Web Development"],
      remote: true,
    },
  },
  {
    input: "Show me fellowships for recent graduates",
    expected: {
      categories: ["Fellowship"],
      experience: "Recent Graduate",
    },
  },
  {
    input: "I want open source internships",
    expected: {
      categories: ["Internship"],
      interests: ["Open Source"],
    },
  },
];

/**
 * Hindi/Hinglish query fixtures
 */
export const HINDI_FIXTURES: SarvamMockFixture[] = [
  {
    input: "Bharat mein remote AI internships chahiye",
    expected: {
      categories: ["Internship"],
      interests: ["AI / ML"],
      remote: true,
      location: "India",
    },
  },
  {
    input: "Mujhe India mein remote software internships chahiye",
    expected: {
      categories: ["Internship"],
      interests: ["Software Engineering"],
      remote: true,
      location: "India",
    },
  },
];

/**
 * Post-processed fixtures (after Hindi location normalization)
 */
export const POST_PROCESSED_FIXTURES: SarvamMockFixture[] = [
  {
    input: "Bharat mein remote AI internships chahiye",
    expected: {
      categories: ["Internship"],
      interests: ["AI / ML"],
      remote: true,
      location: "India",
    },
  },
  {
    input: "Bengaluru mein AI internships chahiye",
    expected: {
      categories: ["Internship"],
      interests: ["AI / ML"],
      location: "Bengaluru",
    },
  },
];

/**
 * Helper to get fixture by input text.
 */
export function getFixture(input: string): SarvamMockFixture | undefined {
  return [...ENGLISH_FIXTURES, ...HINDI_FIXTURES].find(
    f => f.input.toLowerCase() === input.toLowerCase()
  );
}

/**
 * Get all fixture inputs for parameterized testing.
 */
export function getAllFixtureInputs(): string[] {
  return [...ENGLISH_FIXTURES, ...HINDI_FIXTURES].map(f => f.input);
}

/**
 * Sarvam AI Mock Module
 *
 * Deterministic responses for development and testing.
 * When SARVAM_MOCK=true, the AI interpret endpoint uses these fixtures
 * instead of calling the real Sarvam API.
 *
 * This preserves API credits during development and CI.
 */

interface MockPreferences {
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

  // Fallback: try keyword extraction
  const preferences: MockPreferences = {};

  // Category detection
  if (/\b(intern|internship)\b/i.test(lower)) preferences.category = ["Internship"];
  else if (/\b(hackathon|hack)\b/i.test(lower)) preferences.category = ["Hackathon"];
  else if (/\b(job|jobs|hiring)\b/i.test(lower)) preferences.category = ["Job"];
  else if (/\b(fellowship)\b/i.test(lower)) preferences.category = ["Fellowship"];
  else if (/\b(event|events)\b/i.test(lower)) preferences.category = ["Event"];
  else if (/\b(grant|grants)\b/i.test(lower)) preferences.category = ["Grant"];
  else if (/\b(scholarship)\b/i.test(lower)) preferences.category = ["Scholarship"];

  // Interest detection — check specific domains FIRST to avoid generic matches
  const interests: string[] = [];
  if (/\b(cybersecurity|cyber security|infosec|pentest|penetration|vulnerability)\b/i.test(lower)) interests.push("Cybersecurity");
  if (/\b(ai|ml|machine learning|artificial intelligence|deep learning|nlp|llm)\b/i.test(lower)) interests.push("AI / ML");
  if (/\b(data science|data scientist|analytics)\b/i.test(lower)) interests.push("Data Science");
  if (/\b(frontend|front-end|react|vue|angular)\b/i.test(lower)) interests.push("Web Development");
  if (/\b(backend|back-end|server)\b/i.test(lower)) interests.push("Software Engineering");
  if (/\b(design|ux|ui|figma)\b/i.test(lower)) interests.push("Design");
  if (/\b(open source|opensource|foss)\b/i.test(lower)) interests.push("Open Source");
  if (/\b(product|pm)\b/i.test(lower)) interests.push("Product Management");
  if (/\b(software|developer|engineer|coding)\b/i.test(lower) && !interests.length) interests.push("Software Engineering");
  if (interests.length > 0) preferences.interests = interests;

  // Remote — match both "remote" and "remotely"
  if (/\b(remote|remotely|work from home|wfh|online)\b/i.test(lower)) preferences.remote = true;

  // Location (English)
  if (/\b(india)\b/i.test(lower)) preferences.location = "India";
  else if (/\b(bengaluru|bangalore)\b/i.test(lower)) preferences.location = "Bengaluru";
  else if (/\b(mumbai|bombay)\b/i.test(lower)) preferences.location = "Mumbai";
  else if (/\b(delhi)\b/i.test(lower)) preferences.location = "Delhi";
  else if (/\b(global|worldwide)\b/i.test(lower)) preferences.location = "Global";

  // Location (Hindi)
  if (/भारत|bharat/i.test(lower)) preferences.location = "India";
  if (/बेंगलुरु|बैंगलोर/i.test(lower)) preferences.location = "Bengaluru";
  if (/मुंबई|bombay/i.test(lower)) preferences.location = "Mumbai";
  if (/दिल्ली/i.test(lower)) preferences.location = "Delhi";

  // Experience
  if (/\b(student|undergraduate|campus)\b/i.test(lower)) preferences.experience = "Student";
  else if (/\b(recent graduate|fresh graduate)\b/i.test(lower)) preferences.experience = "Recent Graduate";
  else if (/\b(working professional|experienced)\b/i.test(lower)) preferences.experience = "Working Professional";

  // Only return if we found something meaningful
  if (Object.keys(preferences).length === 0) return null;
  return preferences;
}

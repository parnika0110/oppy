/**
 * Location normalization for OPPY.
 *
 * Maps all variants (Hindi, Kannada, English, romanized) to canonical forms.
 * Preserves city/state/country hierarchy.
 */

export interface NormalizedLocation {
  city?: string;
  state?: string;
  country?: string;
  isRemote?: boolean;
  raw: string;
}

export type LocationCompatLevel =
  | "exact_city"
  | "exact_state"
  | "exact_country"
  | "remote_compatible"
  | "global"
  | "different_country"
  | "none";

export interface LocationCompatResult {
  level: LocationCompatLevel;
  score: number;
}

// ── Canonical mappings ────────────────────────────────────────────────────

const CITY_ALIASES: Record<string, string> = {
  // Bengaluru
  bengaluru: "Bengaluru", bangalore: "Bengaluru", "bengaluru, karnataka": "Bengaluru",
  "bangalore, karnataka": "Bengaluru", "bengaluru urban": "Bengaluru",
  "ಬೆಂಗಳೂರು": "Bengaluru", "बेंगलुरु": "Bengaluru", "बैंगलोर": "Bengaluru",
  // Mumbai
  mumbai: "Mumbai", bombay: "Mumbai", "मुंबई": "Mumbai",
  // Delhi
  delhi: "Delhi", "new delhi": "Delhi", "दिल्ली": "Delhi", "नई दिल्ली": "Delhi",
  // Hyderabad
  hyderabad: "Hyderabad", "हैदराबाद": "Hyderabad", "ಹೈದರಾಬಾದ್": "Hyderabad",
  // Chennai
  chennai: "Chennai", madras: "Chennai", "चेन्नई": "Chennai", "मद्रास": "Chennai",
  // Pune
  pune: "Pune", "पुणे": "Pune",
  // Kolkata
  kolkata: "Kolkata", calcutta: "Kolkata", "कोलकाता": "Kolkata",
  // Ahmedabad
  ahmedabad: "Ahmedabad", "अहमदाबाद": "Ahmedabad",
  // Jaipur
  jaipur: "Jaipur", "जयपुर": "Jaipur",
  // US cities
  "san francisco": "San Francisco", sf: "San Francisco",
  "new york": "New York", nyc: "New York",
  seattle: "Seattle", "los angeles": "Los Angeles", la: "Los Angeles",
  austin: "Austin", boston: "Boston", chicago: "Chicago",
  // Global
  remote: "Remote", online: "Remote", "work from home": "Remote", wfh: "Remote",
  "दूरस्थ": "Remote", "ಉದ್ಯೋಗ": "Remote",
};

const STATE_ALIASES: Record<string, string> = {
  karnataka: "Karnataka", "ಕರ್ನಾಟಕ": "Karnataka", "कर्नाटक": "Karnataka",
  maharashtra: "Maharashtra", "महाराष्ट्र": "Maharashtra",
  "tamil nadu": "Tamil Nadu", tamilnadu: "Tamil Nadu", "தமிழ்நாடு": "Tamil Nadu",
  telangana: "Telangana", "तेलंगाना": "Telangana",
  kerala: "Kerala", "केरल": "Kerala", "കേരളം": "Kerala",
  "uttar pradesh": "Uttar Pradesh", "up": "Uttar Pradesh",
  rajasthan: "Rajasthan", "राजस्थान": "Rajasthan",
  gujarat: "Gujarat", "गुजरात": "Gujarat", "ગુજરાત": "Gujarat",
  "west bengal": "West Bengal", "পশ্চিমবঙ্গ": "West Bengal",
  punjab: "Punjab", "पंजाब": "Punjab", "ਪੰਜਾਬ": "Punjab",
  // US states
  california: "California", "new york": "New York State", texas: "Texas",
  washington: "Washington",
};

const COUNTRY_ALIASES: Record<string, string> = {
  india: "India", "भारत": "India", bharat: "India", hindustan: "India",
  "हिंदुस्तान": "India", "భారతదేశం": "India", "ಭಾರತ": "India",
  "us": "United States", usa: "United States", "united states": "United States",
  "अमेरिका": "United States", america: "United States",
  uk: "United Kingdom", "united kingdom": "United Kingdom", britain: "United Kingdom",
  canada: "Canada", "कनाडा": "Canada",
  germany: "Germany", "जर्मनी": "Germany",
  australia: "Australia", "ऑस्ट्रेलिया": "Australia",
  singapore: "Singapore", "सिंगापुर": "Singapore",
  global: "Global", worldwide: "Global", international: "Global",
  "वैश्विक": "Global",
};

// ── Normalization ─────────────────────────────────────────────────────────

/**
 * Normalize a location string to a canonical form.
 */
export function normalizeLocation(raw: string): NormalizedLocation {
  if (!raw) return { raw: "" };

  const lower = raw.toLowerCase().trim();

  // Check for remote
  if (/remote|online|work from home|wfh|दूरस्थ/i.test(lower)) {
    return { isRemote: true, raw };
  }

  // Check for global
  if (/global|worldwide|international|वैश्विक/i.test(lower)) {
    return { country: "Global", raw };
  }

  // Try to identify components
  let city: string | undefined;
  let state: string | undefined;
  let country: string | undefined;

  // Check city first (most specific)
  for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
    if (lower.includes(alias)) {
      city = canonical;
      break;
    }
  }

  // Check state
  for (const [alias, canonical] of Object.entries(STATE_ALIASES)) {
    if (lower.includes(alias)) {
      state = canonical;
      break;
    }
  }

  // Check country
  for (const [alias, canonical] of Object.entries(COUNTRY_ALIASES)) {
    if (lower.includes(alias)) {
      country = canonical;
      break;
    }
  }

  // Infer country from city if not explicitly set
  if (city && !country) {
    const indianCities = ["Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad", "Jaipur"];
    if (indianCities.includes(city)) country = "India";
    const usCities = ["San Francisco", "New York", "Seattle", "Los Angeles", "Austin", "Boston", "Chicago"];
    if (usCities.includes(city)) country = "United States";
  }

  // Infer state from city if not explicitly set
  if (city && !state) {
    if (city === "Bengaluru") state = "Karnataka";
    if (city === "Mumbai" || city === "Pune") state = "Maharashtra";
    if (city === "Chennai") state = "Tamil Nadu";
    if (city === "Hyderabad") state = "Telangana";
    if (city === "Kolkata") state = "West Bengal";
    if (city === "Ahmedabad" || city === "Jaipur") state = undefined; // Not primary
  }

  return { city, state, country, raw };
}

/**
 * Check if an opportunity's location is compatible with the user's preferred location.
 */
export function locationCompatibility(
  oppLoc: NormalizedLocation,
  userLoc: NormalizedLocation
): LocationCompatResult {
  // Both remote
  if (oppLoc.isRemote && userLoc.isRemote) {
    return { level: "exact_city", score: 25 };
  }
  if (oppLoc.isRemote && userLoc.country) {
    // Remote is compatible with any country request
    return { level: "remote_compatible", score: 15 };
  }
  if (userLoc.isRemote && oppLoc.isRemote) {
    return { level: "exact_city", score: 25 };
  }

  // Global is always compatible
  if (oppLoc.country === "Global") {
    return { level: "global", score: 5 };
  }

  // Exact city match
  if (oppLoc.city && userLoc.city && oppLoc.city === userLoc.city) {
    return { level: "exact_city", score: 25 };
  }

  // City in user's state
  if (oppLoc.city && userLoc.state) {
    // Check if city is in the user's state
    const stateCities: Record<string, string[]> = {
      Karnataka: ["Bengaluru"],
      Maharashtra: ["Mumbai", "Pune"],
      "Tamil Nadu": ["Chennai"],
      Telangana: ["Hyderabad"],
      "West Bengal": ["Kolkata"],
    };
    const cities = stateCities[userLoc.state] || [];
    if (cities.includes(oppLoc.city)) {
      return { level: "exact_state", score: 22 };
    }
  }

  // Exact state match
  if (oppLoc.state && userLoc.state && oppLoc.state === userLoc.state) {
    return { level: "exact_state", score: 22 };
  }

  // Opportunity in user's country
  if (oppLoc.country && userLoc.country && oppLoc.country === userLoc.country) {
    return { level: "exact_country", score: 18 };
  }

  // Different country
  if (oppLoc.country && userLoc.country && oppLoc.country !== userLoc.country) {
    return { level: "different_country", score: -10 };
  }

  return { level: "none", score: 0 };
}

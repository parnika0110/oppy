/**
 * Shared extraction utilities for parsing structured metadata from
 * opportunity descriptions. Used by:
 *
 * 1. Ingestion adapters (fallback extraction when source selectors miss data)
 * 2. Backfill script (extracting structured fields from legacy descriptions)
 * 3. Card/detail rendering (display-time extraction for legacy records)
 *
 * These are FALLBACK extractors — they only fire when the structured field
 * is null/empty. They never overwrite existing verified structured data.
 */

// ── Stipend extraction ──────────────────────────────────────────────────────

/**
 * Extract stipend/compensation from text.
 * Preserves ranges (₹7,000 - ₹1,02,000/month) and currency symbols.
 * Returns null if no stipend information found.
 */
export function extractStipendFromText(text: string): string | null {
  if (!text) return null;

  // Pattern 1: "Stipend: ₹X - Y/month" or "Stipend: ₹X - Y /month"
  const m1 = text.match(/stipend:\s*(₹[\s]*[\d,.\u20B9]+(?:\s*[-–—]\s*₹?[\s]*[\d,.\u20B9]+)?(?:\s*\/?(?:month|week|day|annum|year))?)/i);
  if (m1) return m1[1].trim();

  // Pattern 2: "Stipend: ₹X to Y" (without /month)
  const m2 = text.match(/stipend:\s*(₹[\s]*[\d,.\u20B9]+(?:\s*(?:to|-|–|—)\s*₹?[\s]*[\d,.\u20B9]+)?)/i);
  if (m2) return m2[1].trim();

  // Pattern 3: Inline ₹X - Y/month (not preceded by "Stipend:")
  const m3 = text.match(/(₹[\s]*[\d,.\u20B9]+\s*[-–—]\s*₹?[\s]*[\d,.\u20B9]+\s*\/(?:month|week|day|annum|year))/i);
  if (m3) return m3[1].trim();

  // Pattern 4: "₹X /month" (single value)
  const m4 = text.match(/(₹[\s]*[\d,.\u20B9]+\s*\/(?:month|week|day|annum|year))/i);
  if (m4) return m4[1].trim();

  // Pattern 5: "$X - $Y/year" or "$Xk - $Yk"
  const m5 = text.match(/(\$[\d,]+(?:k|K)?\s*[-–—]\s*\$[\d,]+(?:k|K)?(?:\s*\/(?:year|month|annum))?)/i);
  if (m5) return m5[1].trim();

  // Pattern 6: "Unpaid" / "Volunteer" / "unpaid"
  if (/\b(unpaid|volunteer|no\s+stipend)\b/i.test(text)) {
    return "Unpaid";
  }

  return null;
}

// ── Duration extraction ──────────────────────────────────────────────────────

/**
 * Extract duration from text.
 * Normalizes variations like "3 Months", "3 month", "3-month" while preserving display value.
 */
export function extractDurationFromText(text: string): string | null {
  if (!text) return null;

  // Pattern 1: "Duration: 3 Months" / "Duration: 6 Weeks"
  const m1 = text.match(/duration:\s*(\d+\s*(?:Month|Week|Day|Year)s?)/i);
  if (m1) return normalizeDuration(m1[1]);

  // Pattern 2: "3 Months" standalone
  const m2 = text.match(/\b(\d+\s*(?:Month|Week|Day|Year)s?)\b/i);
  if (m2) return normalizeDuration(m2[1]);

  // Pattern 3: "3-month" / "3 month" (hyphenated)
  const m3 = text.match(/\b(\d+[\s-]*(?:month|week|day|year)s?)\b/i);
  if (m3) return normalizeDuration(m3[1]);

  // Pattern 4: "Ongoing" / "Rolling"
  if (/\b(ongoing|rolling|flexible)\b/i.test(text)) {
    return "Ongoing";
  }

  return null;
}

function normalizeDuration(raw: string): string {
  const trimmed = raw.trim();
  // Capitalize first letter of unit, ensure singular for 1, plural otherwise
  return trimmed.replace(/(\d+)\s*(month|week|day|year)s?/i, (_, num, unit) => {
    const capitalized = unit.charAt(0).toUpperCase() + unit.slice(1).toLowerCase();
    const plural = num === "1" ? capitalized : capitalized + "s";
    return `${num} ${plural}`;
  });
}

// ── Start date extraction ────────────────────────────────────────────────────

/**
 * Extract start date from text.
 * Common Internshala values: "Immediately", "Starts from Nov 1", "Within 7 days"
 */
export function extractStartDateFromText(text: string): string | null {
  if (!text) return null;

  // Pattern 1: "Start Date: Immediately" / "Starting from Immediately"
  const m1 = text.match(/start(?:ing)?\s*(?:from|date)?:?\s*(immediately|within\s+\d+\s+days?|asap|flexible)/i);
  if (m1) return m1[1].trim();

  // Pattern 2: "Starts from Nov 1" / "Start Date: Nov 2026"
  const m2 = text.match(/start(?:ing)?\s*(?:from|date)?:?\s*(\w+\s+\d{1,2}(?:,?\s*\d{4})?)/i);
  if (m2) return m2[1].trim();

  return null;
}

// ── Application deadline extraction ──────────────────────────────────────────

/**
 * Extract application deadline from text.
 * Common patterns: "Apply by 2 Oct '26", "Deadline: Nov 15, 2026"
 */
export function extractDeadlineFromText(text: string): { date: Date; label: string } | null {
  if (!text) return null;

  // Pattern 1: "Apply by 2 Oct '26" / "Apply by Oct 2, 2026"
  const m1 = text.match(/apply\s+by[:\s]*(\d{1,2}\s+\w{3}\s+['']?\d{2,4})/i);
  if (m1) {
    const parsed = parseFlexibleDate(m1[1]);
    if (parsed) return { date: parsed, label: m1[1].trim() };
  }

  // Pattern 2: "Deadline: Nov 15, 2026" / "Deadline: 15 Nov 2026"
  const m2 = text.match(/deadline[:\s]*(\d{1,2}\s+\w{3,9}\s+['']?\d{2,4}|\w{3,9}\s+\d{1,2},?\s*\d{4})/i);
  if (m2) {
    const parsed = parseFlexibleDate(m2[1]);
    if (parsed) return { date: parsed, label: m2[1].trim() };
  }

  // Pattern 3: "Applications close Oct 2, 2026"
  const m3 = text.match(/applications?\s+close[:\s]*(\w{3,9}\s+\d{1,2},?\s*\d{4})/i);
  if (m3) {
    const parsed = parseFlexibleDate(m3[1]);
    if (parsed) return { date: parsed, label: m3[1].trim() };
  }

  return null;
}

function parseFlexibleDate(dateStr: string): Date | null {
  // Handle "'26" → "2026"
  const normalized = dateStr.replace(/[''](\d{2})\b/, '20$1');
  // Try standard JS parsing
  const d = new Date(normalized);
  if (!isNaN(d.getTime()) && d.getFullYear() >= 2024 && d.getFullYear() <= 2030) {
    return d;
  }
  return null;
}

// ── Work mode / remote extraction ────────────────────────────────────────────

/**
 * Determine work mode from location text.
 * Returns canonical work mode string.
 */
export function extractWorkMode(location: string): string {
  if (!location) return "Unknown";
  const lower = location.toLowerCase();
  if (/work\s*from\s*home|wfh|remote/i.test(lower)) return "Remote";
  if (/hybrid/i.test(lower)) return "Hybrid";
  if (/onsite|on[- ]site|office/i.test(lower)) return "On-site";
  return "On-site";
}

// ── Employment type extraction ───────────────────────────────────────────────

/**
 * Normalize employment type from source data.
 */
export function normalizeEmploymentType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (/internship/.test(lower)) return "Internship";
  if (/part[- _]?time/.test(lower)) return "Part-time";
  if (/full[- _]?time/.test(lower)) return "Full-time";
  if (/contract/.test(lower)) return "Contract";
  if (/freelance/.test(lower)) return "Freelance";
  return raw.trim();
}

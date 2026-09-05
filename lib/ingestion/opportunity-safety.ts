/**
 * Opportunity safety assessment — fraud / payment-required detection.
 *
 * Internshala (and other job boards) occasionally host internships where
 * candidates are asked to pay for training, registration, security deposits,
 * or are promised an internship only after purchasing a course. This module
 * detects those with a CONTEXT-AWARE scoring approach — never a single
 * keyword — because legitimate postings routinely mention "training",
 * "course", or "certificate" (Internshala even hosts training products).
 *
 * Policy:
 *   - HIGH (blocked): candidate is required to pay the employer/platform as a
 *     condition of the opportunity. Records are skipped at ingestion and never
 *     stored. A safety.exclusion also exists in public queries (defensive).
 *   - MEDIUM (review): ambiguous but suspicious (e.g. "paid training",
 *     "course required before internship"). Stored with safety.level=review
 *     for future admin tooling; remains visible today so we never aggressively
 *     hide legitimate listings.
 *   - LOW/clean: "training provided", "certificate after internship", stipend
 *     language, etc. No action.
 *
 * Key rules:
 *   - Signals are evaluated per sentence (paragraph) so unrelated text in a
 *     long description cannot trigger them ("training program for employees"
 *     in one paragraph must not be scored against a fee in another).
 *   - Payment direction matters: only candidate-pays patterns are signals.
 *     Employer-paid language ("stipend", "paid internship") never fires.
 *   - Negation ("no registration fee", "fee is not applicable", "free of
 *     cost", "waived") suppresses signals in the same sentence.
 *   - Event/Hackathon categories allow entry fees (tickets are legitimate),
 *     so fee patterns downgrade to review-level at most for those categories.
 */

export type SafetyLevel = "clean" | "review" | "blocked";

export interface SafetyAssessment {
  level: SafetyLevel;
  reasons: string[];
}

/** Strong, high-confidence candidate-pays patterns. */
const HIGH_SIGNALS: Array<[RegExp, string]> = [
  [/\bregistration\s+fee\b/i, "registration fee"],
  [/\bsecurity\s+deposit\b/i, "security deposit"],
  [/\b(?:refundable\s+)?deposit\s+(?:required|mandatory|to\s+be\s+paid|amount|of\s+₹)/i, "deposit required from candidate"],
  [/\btraining\s+fee\b/i, "training fee"],
  [/\bcourse\s+fee\b/i, "course fee"],
  [/\bfee\s+(?:is\s+)?(?:mandatory|required|compulsory)\b/i, "mandatory fee"],
  [/\bpayment\s+(?:is\s+)?(?:mandatory|required|compulsory)\b/i, "mandatory payment"],
  [/\bpay(?:ment)?\b.{0,50}\b(?:to\s+join|after\s+selection|before\s+joining|before\s+selection|to\s+get\s+(?:this\s+)?internship|for\s+the\s+internship)\b/i, "pay required to join/after selection"],
  [/\b(?:pay|paying|payment)\b.{0,60}\b(?:before|prior\s+to)\s+(?:joining|starting|selection)\b/i, "payment required before joining"],
  [/\bguaranteed\s+internship\b.{0,80}\b(?:after|upon|when)\b.{0,60}\b(?:purchase|buy|enroll|enrol|complete|take)\b/i, "guaranteed internship after purchase"],
  [/\bmoney\b.{0,40}\b(?:to\s+get|for\s+the\s+internship)\b/i, "money required for internship"],
  [/\bfee\b.{0,30}\b(?:from|by)\s+(?:the\s+)?(?:candidate|student|applicant|you)\b/i, "fee demanded from candidate"],
  [/\b(?:you|you'?ll|candidate|student|applicant|trainee|intern)\b.{0,20}\bpay\b.{0,40}\b(?:for\s+(?:the\s+)?(?:training|course|registration))\b/i, "candidate pays for training/course/registration"],
];

/** Ambiguous but suspicious patterns — flagged for review, not blocked. */
const MEDIUM_SIGNALS: Array<[RegExp, string]> = [
  [/\bpaid\s+training\b/i, "paid training mentioned"],
  [/\bcourse\b.{0,60}\b(?:required|mandatory)\b.{0,60}\b(?:before|for\s+the\s+internship)\b/i, "course required before internship"],
  [/\bcourse\b.{0,60}\b(?:before|prior\s+to)\b.{0,40}\binternship\b/i, "course before internship"],
  [/\bcertificate\s+course\b.{0,50}\b(?:fee|paid|charge|cost)\b/i, "paid certificate course"],
  [/\bpay\b.{0,60}\binternship\b/i, "payment mentioned near internship"],
  [/\bjoin\b.{0,40}\b(?:fee|deposit|payment|amount)\b/i, "fee/deposit to join"],
];

/** Same-sentence negation — these make fee/deposit mentions benign. */
const NEGATION =
  /\b(?:no\s+(?:registration\s+)?fee|no\s+(?:security\s+)?deposit|no\s+payment|no\s+cost|free\s+of\s+cost|no\s+charges|no\s+charge|no\s+need\s+to\s+pay|not\s+(?:required|mandatory|applicable|needed|necessary)|exempt(?:ed)?|waiv(?:e|ed|er)|without\s+(?:any\s+)?(?:fee|payment|charge|deposit)|nothing\s+to\s+pay|zero\s+(?:fee|cost))\b/i;

/** Categories where entry fees are normal (tickets), so fees are NOT scams. */
const FEE_NORMAL_CATEGORIES = new Set(["Event", "Hackathon"]);

/**
 * Split free text into sentences so signals stay context-local.
 *
 * Paragraphs (\n) are split FIRST — the title and each description paragraph
 * must never merge into one sentence, or a pattern could match across the
 * boundary (e.g. title "Marketing Intern" + "We pay for training" would look
 * like candidate-pays language). Only then are sentences split on punctuation
 * and whitespace normalized.
 */
function sentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/))
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 0);
}

/**
 * Score a raw opportunity for payment/scam risk.
 *
 * @param input.title        Opportunity title (optional)
 * @param input.description  Full description text (optional)
 * @param input.category     OPPY category (affects fee-normal categories)
 */
export function assessOpportunitySafety(input: {
  title?: string | null;
  description?: string | null;
  category?: string | null;
}): SafetyAssessment {
  // NOTE: keep the raw text (title + \n + description) — do NOT collapse
  // whitespace here, or the paragraph boundary between title and description
  // is lost before sentences() can split on it.
  const text = `${input.title || ""}\n${input.description || ""}`;
  const reasons: string[] = [];
  let blocked = false;
  let review = false;

  if (!text.trim()) {
    return { level: "clean", reasons };
  }

  const feeNormal = Boolean(input.category && FEE_NORMAL_CATEGORIES.has(input.category));
  const highSignals = feeNormal ? [] : HIGH_SIGNALS;

  for (const sentence of sentences(text)) {
    if (NEGATION.test(sentence)) continue; // "no registration fee", "fee waived", etc.

    for (const [re, label] of highSignals) {
      if (re.test(sentence)) {
        blocked = true;
        reasons.push(label);
      }
    }
    if (blocked) break;

    for (const [re, label] of MEDIUM_SIGNALS) {
      if (re.test(sentence)) {
        review = true;
        reasons.push(label);
      }
    }
  }

  if (blocked) return { level: "blocked", reasons: [...new Set(reasons)] };
  if (review) return { level: "review", reasons: [...new Set(reasons)] };
  return { level: "clean", reasons };
}
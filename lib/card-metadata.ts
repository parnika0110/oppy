/**
 * Centralized display-time extraction of structured metadata from description text.
 *
 * These functions are temporary display-time helpers until the ingestion parser
 * stores stipend/duration as top-level MongoDB fields. Once that happens,
 * OpportunityCard will prefer the structured fields and these fallbacks
 * will only be needed for legacy records.
 */

/** Extract stipend / compensation from description text. */
export function extractStipend(desc: string | null | undefined): string | null {
  if (!desc) return null;
  // Prefer explicit "Stipend: ₹X" pattern
  const m = desc.match(/stipend:\s*([^\.]+)/i);
  if (m) return m[1].trim().replace(/\s+\/month/i, '\u00a0/month');
  // Fall back to inline ₹ amount pattern
  const m2 = desc.match(/(₹[\s]*[\d,\.\\-–]+[^\.]*\/month)/i);
  if (!m2) return null;
  // Keep /month visually attached to the amount (non-breaking space before unit)
  return m2[1].trim().replace(/\s+\/month/i, '\u00a0/month');
}

/** Extract duration from description text. */
export function extractDuration(desc: string | null | undefined): string | null {
  if (!desc) return null;
  // Prefer explicit "Duration: X Months" pattern
  const m = desc.match(/duration:\s*([^\.]+)/i);
  if (m) return m[1].trim();
  // Fall back to inline "N Month(s)" / "N Week(s)" pattern
  const m2 = desc.match(/(\d+\s*(?:Month|Week|Day|Year)s?)/i);
  return m2 ? m2[1].trim() : null;
}

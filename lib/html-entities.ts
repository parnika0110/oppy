/**
 * HTML Entity Decoder for OPPY opportunity data.
 *
 * Decodes common HTML entities that appear in ingested content
 * (RSS feeds, Hacker News HTML, Eventbrite, etc.) into their
 * human-readable equivalents.
 *
 * SECURITY: This does NOT execute HTML — it only converts named/numeric
 * character references to their text equivalents. No innerHTML, no DOM,
 * no script execution.
 */

// ── Named entity map (common subset) ─────────────────────────────────────
const NAMED_ENTITIES: Record<string, string> = {
  // Punctuation & symbols
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&lsquo;": "\u2018",
  "&rsquo;": "\u2019",
  "&ldquo;": "\u201C",
  "&rdquo;": "\u201D",
  "&ndash;": "\u2013",
  "&mdash;": "\u2014",
  "&nbsp;": " ",
  "&hellip;": "\u2026",
  "&middot;": "\u00B7",
  "&bull;": "\u2022",
  "&copy;": "\u00A9",
  "&reg;": "\u00AE",
  "&trade;": "\u2122",
  "&euro;": "\u20AC",
  "&pound;": "\u00A3",
  "&yen;": "\u00A5",
  "&cent;": "\u00A2",

  // Arrows
  "&larr;": "\u2190",
  "&rarr;": "\u2192",
  "&uarr;": "\u2191",
  "&darr;": "\u2193",
  "&laquo;": "\u00AB",
  "&raquo;": "\u00BB",

  // Math / comparison
  "&times;": "\u00D7",
  "&divide;": "\u00F7",
  "&plusmn;": "\u00B1",
  "&ne;": "\u2260",
  "&le;": "\u2264",
  "&ge;": "\u2265",

  // Misc
  "&deg;": "\u00B0",
  "&para;": "\u00B6",
  "&sect;": "\u00A7",
  "&uml;": "\u00A8",
  "&macr;": "\u00AF",
  "&curren;": "\u00A4",
  "&brvbar;": "\u00A6",
  "&iquest;": "\u00BF",
  "&iexcl;": "\u00A1",
  "&not;": "\u00AC",
  "&shy;": "\u00AD",
  "&softhyphen;": "\u00AD",
  "&comma;": ",",
  "&period;": ".",
  "&colon;": ":",
  "&semi;": ";",
  "&excl;": "!",
  "&quest;": "?",

  // Common accented characters (used in names/locations)
  "&aacute;": "\u00E1",
  "&eacute;": "\u00E9",
  "&iacute;": "\u00ED",
  "&oacute;": "\u00F3",
  "&uacute;": "\u00FA",
  "&Aacute;": "\u00C1",
  "&Eacute;": "\u00C9",
  "&Iacute;": "\u00CD",
  "&Oacute;": "\u00D3",
  "&Uacute;": "\u00DA",
  "&ccedil;": "\u00E7",
  "&Ccedil;": "\u00C7",
  "&ntilde;": "\u00F1",
  "&Ntilde;": "\u00D1",
  "&egrave;": "\u00E8",
  "&agrave;": "\u00E0",
  "&ugrave;": "\u00F9",
  "&oslash;": "\u00F8",
  "&aring;": "\u00E5",
  "&auml;": "\u00E4",
  "&ouml;": "\u00F6",
  "&uuml;": "\u00FC",
  "&szlig;": "\u00DF",
  "&iuml;": "\u00EF",
  "&Iuml;": "\u00CF",
  "&micro;": "\u00B5",
  "&THORN;": "\u00DE",
  "&thorn;": "\u00FE",
  "&yacute;": "\u00FD",
  "&Yacute;": "\u00DD",
  "&eth;": "\u00F0",
  "&ETH;": "\u00D0",
  "&aelig;": "\u00E6",
  "&AElig;": "\u00C6",
  "&lrm;": "\u200E",
  "&rlm;": "\u200F",
  "&zwj;": "\u200D",
  "&zwnj;": "\u200C",
  "&ensp;": "\u2002",
  "&emsp;": "\u2003",
  "&thinsp;": "\u2009",
};

/**
 * Decode all HTML entities in a string to their text equivalents.
 *
 * Handles:
 *   - Named entities: &amp; → &, &#x2F; → /, &#x2014; → —
 *   - Numeric decimal: &#60; → <
 *   - Numeric hexadecimal: &#x3C; → <, &#x2F1F; → /
 *
 * Does NOT:
 *   - Execute HTML tags
 *   - Parse the string as HTML
 *   - Introduce XSS vectors
 */
export function decodeHtmlEntities(text: string): string {
  if (!text || typeof text !== "string") return text;

  // Phase 1: Decode hex numeric references (&#x...;)
  let result = text.replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => {
    try {
      const code = parseInt(hex, 16);
      if (code > 0 && code < 0x10FFFF && !isSurrogate(code)) {
        return String.fromCodePoint(code);
      }
      return _match; // Keep original if invalid
    } catch {
      return _match;
    }
  });

  // Phase 2: Decode decimal numeric references (&#...;)
  result = result.replace(/&#(\d+);/g, (_match, dec) => {
    try {
      const code = parseInt(dec, 10);
      if (code > 0 && code < 0x10FFFF && !isSurrogate(code)) {
        return String.fromCodePoint(code);
      }
      return _match;
    } catch {
      return _match;
    }
  });

  // Phase 3: Decode named entities
  result = result.replace(/&[a-zA-Z]+;/g, (entity) => {
    return NAMED_ENTITIES[entity] || entity;
  });

  return result;
}

/** Check if a code point is a lone surrogate (invalid in JavaScript strings). */
function isSurrogate(code: number): boolean {
  return code >= 0xD800 && code <= 0xDFFF;
}

/**
 * Decode common HTML entities in text fields that come from
 * RSS/HTML/JSON ingestion sources. Safe to apply to titles,
 * descriptions, organization names, locations, and URLs.
 *
 * Returns a new string; does not mutate the input.
 */
export function cleanIngestedText(text: string | null | undefined): string {
  if (!text) return "";
  return decodeHtmlEntities(text).trim();
}

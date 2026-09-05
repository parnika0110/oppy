import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import {
  parseSearchQuery,
  hasSearchSignals,
  canonicalizeSearchParams,
} from "@/lib/search-intent";
import {
  resolveInterest,
  resolveInterests,
  DISCOVERY_INTEREST_OPTIONS,
} from "@/lib/taxonomies";

/**
 * Regression tests for the confirmed search UX issues:
 *
 * 1. Interest-chip vocabulary mismatch — chips displayed "AI"/"Machine Learning"
 *    while the parser wrote the canonical token "AI / ML", so exact-match
 *    active-state detection never highlighted the chip.
 * 2. Stale Remote interaction — `remote=true` left in the URL from a previous
 *    search suppressed natural-language parsing of a new query entirely.
 */

// ── Canonical URL merge (app/page.tsx behaviour) ───────────────────────────

function canonicalFor(query: string, extraParams: Record<string, string> = {}) {
  const intent = parseSearchQuery(query);
  expect(hasSearchSignals(intent)).toBe(true);
  return canonicalizeSearchParams({ q: query, ...extraParams }, intent);
}

describe("canonicalizeSearchParams — NL intent is never bypassed by stale filters", () => {
  it("clean 'AI jobs in Mumbai' → structured params, NO remote", () => {
    const out = canonicalFor("AI jobs in Mumbai");
    expect(out).not.toBeNull();
    expect(out!.get("categories")).toBe("Job");
    expect(out!.get("interests")).toBe("AI / ML");
    expect(out!.get("location")).toBe("Mumbai");
    expect(out!.get("q")).toBe("ai");
    expect(out!.get("remote")).toBeNull();
  });

  it("existing remote=true + new 'AI jobs in Mumbai' → NL intent applied, explicit filter preserved", () => {
    const out = canonicalFor("AI jobs in Mumbai", { remote: "true" });
    expect(out).not.toBeNull();
    // The parse still ran: category / interest / location from the query.
    expect(out!.get("categories")).toBe("Job");
    expect(out!.get("interests")).toBe("AI / ML");
    expect(out!.get("location")).toBe("Mumbai");
    expect(out!.get("q")).toBe("ai");
    // The explicitly selected Remote filter is preserved, not silently dropped.
    expect(out!.get("remote")).toBe("true");
  });

  it("existing remote=true + 'remote AI internships' → intent sets remote AND parse applies", () => {
    const out = canonicalFor("remote AI internships", { remote: "true" });
    expect(out!.get("categories")).toBe("Internship");
    expect(out!.get("interests")).toBe("AI / ML");
    expect(out!.get("remote")).toBe("true");
  });

  it("already-canonical URL is stable (no re-parse redirect loop)", () => {
    const intent = parseSearchQuery("ai");
    const out = canonicalizeSearchParams(
      { q: "ai", categories: "Job", interests: "AI / ML", location: "Mumbai" },
      intent
    );
    expect(out).toBeNull();
  });

  it("explicitly selected structured filter wins over the parsed intent", () => {
    // User had category=Job pinned; new query says hackathons. The manual
    // filter is preserved and the parsed location is added.
    const intent = parseSearchQuery("hackathons in India");
    const out = canonicalizeSearchParams(
      { q: "hackathons in India", categories: "Job" },
      intent
    );
    expect(out).not.toBeNull();
    expect(out!.get("categories")).toBe("Job"); // preserved, not overwritten
    expect(out!.get("location")).toBe("India");
    expect(out!.get("q")).toBeNull(); // no leftover keywords
  });

  it("resets pagination on canonicalization", () => {
    const out = canonicalFor("AI jobs in Mumbai", { page: "3" });
    expect(out!.get("page")).toBeNull();
  });

  it("plain keyword queries with no signals never canonicalize (unchanged)", () => {
    const intent = parseSearchQuery("Python");
    expect(hasSearchSignals(intent)).toBe(false);
    expect(canonicalizeSearchParams({ q: "Python" }, intent)).toBeNull();
  });
});

// ── Chip vocabulary: single source of truth via the shared taxonomy ────────

describe("discovery interest chips — canonical values", () => {
  it("'AI' and 'Machine Learning' chips both use the canonical 'AI / ML' value", () => {
    const ai = DISCOVERY_INTEREST_OPTIONS.find((o) => o.label === "AI");
    const ml = DISCOVERY_INTEREST_OPTIONS.find((o) => o.label === "Machine Learning");
    expect(ai?.value).toBe("AI / ML");
    expect(ml?.value).toBe("AI / ML");
    // Keep the visible labels exactly as before.
    expect(ai?.label).toBe("AI");
    expect(ml?.label).toBe("Machine Learning");
  });

  it("every chip value is the canonical taxonomy label for that chip", () => {
    for (const option of DISCOVERY_INTEREST_OPTIONS) {
      const resolved = resolveInterest(option.label);
      expect(option.value).toBe(resolved?.label ?? option.label);
    }
  });

  it("AI chip highlights when the URL contains the canonical 'AI / ML' token", () => {
    expect(resolveInterests(["AI / ML"])).toEqual(["AI / ML"]);
    expect(resolveInterests(["AI / ML"]).includes("AI / ML")).toBe(true);
  });

  it("Machine Learning chip highlights when the URL contains 'AI / ML'", () => {
    expect(resolveInterests(["AI / ML"])).toEqual(["AI / ML"]);
  });

  it("legacy chip tokens ('AI', 'Machine Learning') canonicalize to the same chip", () => {
    expect(resolveInterests(["AI"])).toEqual(["AI / ML"]);
    expect(resolveInterests(["Machine Learning"])).toEqual(["AI / ML"]);
  });

  it("mixed legacy + canonical tokens dedupe (active-interest count agrees)", () => {
    const canonical = resolveInterests(["AI", "AI / ML", "Machine Learning"]);
    expect(canonical).toEqual(["AI / ML"]);
    expect(canonical.length).toBe(1);
  });

  it("chip click and parser output use the same canonical interest token", () => {
    const chipToken = DISCOVERY_INTEREST_OPTIONS.find((o) => o.label === "AI")!.value;
    const parserToken = parseSearchQuery("AI jobs in Mumbai").interests?.[0];
    expect(parserToken).toBe("AI / ML");
    expect(chipToken).toBe(parserToken);
  });

  it("non-taxonomy labels (Python) keep their label as the chip value", () => {
    const py = DISCOVERY_INTEREST_OPTIONS.find((o) => o.label === "Python");
    expect(py?.value).toBe("Python");
    expect(resolveInterests(["Python"])).toEqual(["Python"]);
    expect(resolveInterests(["Python"]).includes("AI / ML")).toBe(false);
  });
});

// ── Structural guards on the components ────────────────────────────────────

describe("DiscoveryFilters — canonical chip wiring (structural)", () => {
  const code = readFileSync("components/DiscoveryFilters.tsx", "utf8");

  it("imports the shared taxonomy instead of a private label-as-value list", () => {
    expect(code).toContain('DISCOVERY_INTEREST_OPTIONS');
    expect(code).toContain('resolveInterests');
    expect(code).not.toContain('const INTEREST_OPTIONS = [');
  });

  it("active-state detection canonicalizes URL values before comparing", () => {
    expect(code).toContain('const canonicalInterests = resolveInterests(currentInterests);');
    expect(code).toContain('canonicalInterests.includes(option.value)');
  });

  it("chip clicks write the canonical value, not the display label", () => {
    expect(code).toContain('toggleInterest(option)');
    expect(code).toContain('option.value');
    expect(code).toContain('next.join(",")');
  });

  it("active-interest count uses the canonicalized (deduped) set", () => {
    expect(code).toContain('canonicalInterests.length');
  });
});

describe("app/page.tsx — NL parsing not gated by pre-existing filters (structural)", () => {
  const code = readFileSync("app/page.tsx", "utf8");

  it("no longer suppresses NL parsing when structured filters exist", () => {
    expect(code).not.toContain('!hasStructuredFilters');
    expect(code).toContain('if (params.q) {');
  });

  it("uses the shared canonicalizeSearchParams merge helper", () => {
    expect(code).toContain('canonicalizeSearchParams');
    expect(code).toContain('import { parseSearchQuery, hasSearchSignals, canonicalizeSearchParams }');
  });
});
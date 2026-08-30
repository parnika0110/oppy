import { describe, it, expect } from "vitest";
import { decodeHtmlEntities, cleanIngestedText } from "@/lib/html-entities";

describe("decodeHtmlEntities", () => {
  // ── Basic named entities ──────────────────────────────────────────
  it("decodes common named entities", () => {
    expect(decodeHtmlEntities("A&amp;B")).toBe("A&B");
    expect(decodeHtmlEntities("&lt;script&gt;")).toBe("<script>");
    expect(decodeHtmlEntities("&quot;hello&quot;")).toBe('"hello"');
    expect(decodeHtmlEntities("&apos;it&apos;s&quot;")).toBe("'it's\"");
  });

  it("decodes typographic entities", () => {
    expect(decodeHtmlEntities("one &mdash; two")).toBe("one \u2014 two");
    expect(decodeHtmlEntities("a &ndash; b")).toBe("a \u2013 b");
    expect(decodeHtmlEntities("hello&hellip;")).toBe("hello\u2026");
    expect(decodeHtmlEntities("&lsquo;quote&rsquo;")).toBe("\u2018quote\u2019");
    expect(decodeHtmlEntities("&ldquo;quote&rdquo;")).toBe("\u201Cquote\u201D");
    expect(decodeHtmlEntities("x&nbsp;y")).toBe("x y");
  });

  // ── Hex numeric references ────────────────────────────────────────
  it("decodes hex numeric character references", () => {
    expect(decodeHtmlEntities("&#x2F;")).toBe("/");
    expect(decodeHtmlEntities("&#x2014;")).toBe("\u2014");
    expect(decodeHtmlEntities("&#x26;")).toBe("&");
    expect(decodeHtmlEntities("&#x3C;")).toBe("<");
    expect(decodeHtmlEntities("&#x3E;")).toBe(">");
    expect(decodeHtmlEntities("&#x27;")).toBe("'");
    expect(decodeHtmlEntities("&#x22;")).toBe('"');
  });

  // ── Decimal numeric references ────────────────────────────────────
  it("decodes decimal numeric character references", () => {
    expect(decodeHtmlEntities("&#47;")).toBe("/");
    expect(decodeHtmlEntities("&#8212;")).toBe("\u2014");
    expect(decodeHtmlEntities("&#38;")).toBe("&");
    expect(decodeHtmlEntities("&#60;")).toBe("<");
    expect(decodeHtmlEntities("&#62;")).toBe(">");
  });

  // ── Mixed content (real-world examples) ───────────────────────────
  it("decodes real-world opportunity data with mixed entities", () => {
    expect(decodeHtmlEntities("Simulation&#x2F;RL Integration Engineer")).toBe(
      "Simulation/RL Integration Engineer"
    );
    expect(decodeHtmlEntities("https:&#x2F;&#x2F;example.com")).toBe(
      "https://example.com"
    );
    expect(decodeHtmlEntities("Sheffield&#x2F;London")).toBe("Sheffield/London");
    expect(decodeHtmlEntities("Senior (and above) Backend Engineer &#x2014; Instrumentl")).toBe(
      "Senior (and above) Backend Engineer \u2014 Instrumentl"
    );
    expect(decodeHtmlEntities("React &amp; Node.js Developer")).toBe("React & Node.js Developer");
  });

  it("decodes multiple entities in a single string", () => {
    const input = "C&#x2F;C++ &amp; Python &mdash; Remote &#x2F; Global";
    const expected = "C/C++ & Python \u2014 Remote / Global";
    expect(decodeHtmlEntities(input)).toBe(expected);
  });

  // ── Edge cases ────────────────────────────────────────────────────
  it("returns empty string unchanged", () => {
    expect(decodeHtmlEntities("")).toBe("");
  });

  it("returns null/undefined unchanged", () => {
    expect(decodeHtmlEntities(null as any)).toBe(null);
    expect(decodeHtmlEntities(undefined as any)).toBe(undefined);
  });

  it("returns text without entities unchanged", () => {
    expect(decodeHtmlEntities("Hello world")).toBe("Hello world");
    expect(decodeHtmlEntities("Python, React, Node.js")).toBe("Python, React, Node.js");
  });

  it("leaves unrecognized entities intact", () => {
    expect(decodeHtmlEntities("&foobar;")).toBe("&foobar;");
  });

  it("handles surrogate code points safely", () => {
    // &#xD800; is a lone surrogate — should not crash
    expect(decodeHtmlEntities("before&#xD800;after")).toBe("before&#xD800;after");
  });

  it("decodes accented characters", () => {
    expect(decodeHtmlEntities("caf&eacute;")).toBe("caf\u00E9");
    expect(decodeHtmlEntities("na&iuml;ve")).toBe("na\u00EFve");
    expect(decodeHtmlEntities("stra&szlig;e")).toBe("stra\u00DFe");
  });

  it("handles URLs with encoded characters safely", () => {
    // URLs should be decoded but remain valid
    expect(decodeHtmlEntities("https:&#x2F;&#x2F;example.com&#x2F;path")).toBe(
      "https://example.com/path"
    );
    expect(decodeHtmlEntities("https:&#x2F;&#x2F;example.com?a&#x3D;1&amp;b&#x3D;2")).toBe(
      "https://example.com?a=1&b=2"
    );
  });

  it("does not introduce unsafe HTML from decoded content", () => {
    // Decoded < and > should be plain text characters, not HTML tags
    const decoded = decodeHtmlEntities("&lt;script&gt;alert(1)&lt;&#x2F;script&gt;");
    expect(decoded).toBe("<script>alert(1)</script>");
    // The function returns plain text — it is the caller's responsibility
    // to render with React text nodes (not dangerouslySetInnerHTML)
  });

  it("handles double-encoded entities (single pass only)", () => {
    // &amp;#x2F; decodes &amp; → & once, leaving &#x2F; as literal text
    // A single-pass decoder does NOT double-decode — that would be a security risk
    expect(decodeHtmlEntities("&amp;#x2F;")).toBe("&#x2F;");
    // Single-encoded entity decodes normally
    expect(decodeHtmlEntities("&#x2F;")).toBe("/");
  });

  it("handles decimal entities for common characters", () => {
    expect(decodeHtmlEntities("&#39;hello&#39;")).toBe("'hello'");
    expect(decodeHtmlEntities("price: &#163;50")).toBe("price: \u00A350");
    expect(decodeHtmlEntities("temp: &#176;C")).toBe("temp: \u00B0C");
  });

  it("handles large hex values up to Unicode max", () => {
    // U+1F600 (😀) — valid code point
    expect(decodeHtmlEntities("&#x1F600;")).toBe("\u{1F600}");
  });
});

describe("cleanIngestedText", () => {
  it("decodes entities and trims whitespace", () => {
    expect(cleanIngestedText("  &#x2F;hello&#x2F;  ")).toBe("/hello/");
  });

  it("returns empty string for null/undefined/empty", () => {
    expect(cleanIngestedText(null)).toBe("");
    expect(cleanIngestedText(undefined)).toBe("");
    expect(cleanIngestedText("")).toBe("");
  });

  it("preserves legitimate text", () => {
    const title = "Senior Backend Engineer at Stripe";
    expect(cleanIngestedText(title)).toBe(title);
  });

  it("decodes typical ingested HTML entities", () => {
    expect(cleanIngestedText("Python&#x2F;ML Engineer")).toBe("Python/ML Engineer");
    expect(cleanIngestedText("Apply &amp; Register")).toBe("Apply & Register");
    expect(cleanIngestedText("Deadline &#x2014; September 30")).toBe("Deadline \u2014 September 30");
  });
});

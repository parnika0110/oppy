import { createHash } from "crypto";

export function canonicalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((key) => url.searchParams.delete(key));
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function normalizedText(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

export function contentHash(parts: Array<string | undefined | null>): string {
  return createHash("sha256").update(parts.filter(Boolean).join("\n")).digest("hex");
}

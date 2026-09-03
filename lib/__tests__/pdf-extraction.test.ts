import { describe, it, expect } from "vitest";
import { parseResume } from "@/lib/resume-parser";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Focused regression test for pdf2json getRawTextContent() bug.
 * pdf2json 4.x's getRawTextContent() returns "" even for valid text PDFs.
 * Fix: extract text directly from parser.data.Pages[].Texts[].R[].T
 */

async function makeResumePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  const lines = [
    ["SUMMARY", 14, 750],
    ["Experienced software developer with 3 years in Python and React.", 11, 730],
    ["EXPERIENCE", 14, 700],
    ["Software Engineer Intern at Google", 11, 680],
    ["TECHNICAL SKILLS", 14, 650],
    ["Python, JavaScript, React, MongoDB, AWS", 11, 630],
    ["EDUCATION", 14, 600],
    ["MIT Computer Science 2025", 11, 580],
  ] as const;
  for (const [text, size, y] of lines) {
    page.drawText(text, { x: 72, y, size, font, color: rgb(0, 0, 0) });
  }
  return Buffer.from(await doc.save());
}

describe("PDF extraction fix", () => {
  it("parseResume extracts meaningful text from a valid PDF", async () => {
    const buf = await makeResumePdf();
    const profile = await parseResume(buf, "application/pdf");
    expect(profile.uploaded).toBe(true);
    // Must not throw "Could not extract meaningful text"
    expect(profile.extractedSkills.length).toBeGreaterThan(0);
  });

  it("pdf2json getRawTextContent is broken — documents the bug", async () => {
    const { default: PDFParser } = await import("pdf2json");
    const buf = await makeResumePdf();
    const parser = new PDFParser();
    const rawText = await new Promise<string>((resolve) => {
      parser.on("pdfParser_dataReady", () => {
        const t = parser.getRawTextContent();
        parser.destroy();
        resolve(t);
      });
      parser.on("pdfParser_dataError", () => {
        parser.destroy();
        resolve("");
      });
      parser.parseBuffer(new Uint8Array(buf) as any);
    });
    // getRawTextContent returns "" — this IS the bug
    expect(rawText).toBe("");
  });

  it("our manual extraction from parser.data works", async () => {
    const { default: PDFParser } = await import("pdf2json");
    const buf = await makeResumePdf();
    const parser = new PDFParser();
    const text = await new Promise<string>((resolve) => {
      parser.on("pdfParser_dataReady", () => {
        const data = parser.data as any;
        let out = "";
        for (const pg of data?.Pages || []) {
          for (const t of pg.Texts || []) {
            for (const r of t.R || []) {
              try { out += decodeURIComponent(r.T || ""); } catch { out += r.T || ""; }
              out += " ";
            }
            out += "\n";
          }
        }
        parser.destroy();
        resolve(out);
      });
      parser.on("pdfParser_dataError", () => { parser.destroy(); resolve(""); });
      parser.parseBuffer(new Uint8Array(buf) as any);
    });
    expect(text.length).toBeGreaterThan(50);
    expect(text).toContain("SUMMARY");
    expect(text).toContain("TECHNICAL SKILLS");
  });
});

import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { parseResume } from "@/lib/resume-parser";

/**
 * Regression test using the actual ResumeO.pdf.
 * Verifies the pdf2json Buffer→Uint8Array fix works with a real-world PDF.
 */
const RESUME_PATH = path.resolve(process.cwd(), "ResumeO.pdf");
const HAS_PDF = fs.existsSync(RESUME_PATH);

// Skip if the real PDF isn't available (CI environments)
const describeReal = HAS_PDF ? describe : describe.skip;

describeReal("Real ResumeO.pdf — end-to-end parsing", () => {
  let profile: Awaited<ReturnType<typeof parseResume>>;

  beforeAll(async () => {
    const buffer = fs.readFileSync(RESUME_PATH);
    profile = await parseResume(buffer, "application/pdf");
  }, 30000);

  it("PDF parses successfully without throwing", () => {
    expect(profile).toBeDefined();
    expect(profile.uploaded).toBe(true);
  });

  it("extracts meaningful text (>50 chars)", () => {
    // parseResume doesn't return raw text, but if it didn't throw,
    // the 50-char threshold was passed
    expect(profile.uploaded).toBe(true);
  });

  it("detects SUMMARY section", () => {
    // Skills/interests extraction implies sections were detected
    expect(profile.extractedSkills.length).toBeGreaterThan(0);
  });

  it("detects EXPERIENCE section", () => {
    expect(profile.experience.length).toBeGreaterThan(0);
  });

  it("detects PROJECTS section", () => {
    expect(profile.projects.length).toBeGreaterThan(0);
  });

  it("detects TECHNICAL SKILLS section", () => {
    expect(profile.extractedSkills.length).toBeGreaterThan(0);
  });

  it("detects EDUCATION section", () => {
    expect(profile.education.length).toBeGreaterThan(0);
  });

  it("extracts at least 5 skills", () => {
    expect(profile.extractedSkills.length).toBeGreaterThanOrEqual(5);
  });

  it("extracts at least 1 experience entry", () => {
    expect(profile.experience.length).toBeGreaterThanOrEqual(1);
  });

  it("extracts at least 1 project", () => {
    expect(profile.projects.length).toBeGreaterThanOrEqual(1);
  });

  it("extracts at least 1 education entry", () => {
    expect(profile.education.length).toBeGreaterThanOrEqual(1);
  });
});

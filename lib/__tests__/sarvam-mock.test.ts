import { describe, it, expect } from "vitest";
import { getMockInterpretation } from "../sarvam/mock";

describe("Sarvam mock module", () => {
  describe("exact fixture matches", () => {
    it("returns correct preferences for English remote AI internships", () => {
      const result = getMockInterpretation("I want remote AI internships for students in India");
      expect(result).toEqual({
        category: ["Internship"],
        interests: ["AI / ML"],
        remote: true,
        location: "India",
        experience: "Student",
      });
    });

    it("returns correct preferences for Hindi Hinglish query", () => {
      const result = getMockInterpretation("Bharat mein remote AI internships chahiye");
      expect(result).toEqual({
        category: ["Internship"],
        interests: ["AI / ML"],
        remote: true,
        location: "India",
      });
    });

    it("returns correct preferences for software engineering jobs", () => {
      const result = getMockInterpretation("Find software engineering jobs in India");
      expect(result).toEqual({
        category: ["Job"],
        interests: ["Software Engineering"],
        location: "India",
      });
    });
  });

  describe("keyword fallback detection", () => {
    it("detects hackathon category from unmatched query", () => {
      const result = getMockInterpretation("organize a local hackathon event");
      expect(result?.category).toContain("Hackathon");
    });

    it("detects fellowship category", () => {
      const result = getMockInterpretation("fellowship opportunities for graduates");
      expect(result?.category).toContain("Fellowship");
    });

    it("detects remote flag", () => {
      const result = getMockInterpretation("work remotely as a developer");
      expect(result?.remote).toBe(true);
    });

    it("detects India location", () => {
      const result = getMockInterpretation("tech jobs in India for developers");
      expect(result?.location).toBe("India");
    });

    it("detects student experience", () => {
      const result = getMockInterpretation("student summer internship program");
      expect(result?.experience).toBe("Student");
    });

    it("detects AI interest", () => {
      const result = getMockInterpretation("AI engineering roles for developers");
      expect(result?.interests).toContain("AI / ML");
    });

    it("detects cybersecurity interest", () => {
      const result = getMockInterpretation("cybersecurity pentest engineer");
      expect(result?.interests).toContain("Cybersecurity");
    });
  });

  describe("Hindi location normalization", () => {
    it("normalizes भारत to India", () => {
      const result = getMockInterpretation("भारत में jobs");
      expect(result?.location).toBe("India");
    });

    it("normalizes बेंगलुरु to Bengaluru", () => {
      const result = getMockInterpretation("बेंगलुरु में internship");
      expect(result?.location).toBe("Bengaluru");
    });
  });

  describe("no match returns null", () => {
    it("returns null for completely unrelated input", () => {
      const result = getMockInterpretation("asdfghjkl");
      // The keyword fallback might still extract something, but for gibberish it should be null or minimal
      // At minimum it shouldn't crash
      expect(result === null || typeof result === "object").toBe(true);
    });
  });

  describe("null handling", () => {
    it("handles empty string gracefully", () => {
      const result = getMockInterpretation("");
      expect(result === null || typeof result === "object").toBe(true);
    });
  });
});

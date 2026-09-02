import { describe, it, expect } from "vitest";
import { normalizeInput, normalizeInputList } from "../normalize-input";

describe("normalizeInput", () => {
  describe("typo corrections", () => {
    it("corrects 'pyhton' to 'Python'", () => {
      expect(normalizeInput("pyhton")).toBe("Python");
    });

    it("corrects 'machne learning' to 'Machine Learning'", () => {
      expect(normalizeInput("machne learning")).toBe("Machine Learning");
    });

    it("corrects 'data enginering' to 'Data Engineering'", () => {
      expect(normalizeInput("data enginering")).toBe("Data Engineering");
    });

    it("corrects 'javscript' to 'JavaScript'", () => {
      expect(normalizeInput("javscript")).toBe("JavaScript");
    });

    it("corrects 'angualr' to 'Angular'", () => {
      expect(normalizeInput("angualr")).toBe("Angular");
    });

    it("corrects 'kubernets' to 'Kubernetes'", () => {
      expect(normalizeInput("kubernets")).toBe("Kubernetes");
    });

    it("corrects 'tensoflow' to 'TensorFlow'", () => {
      expect(normalizeInput("tensoflow")).toBe("TensorFlow");
    });

    it("corrects 'web developement' to 'Web Development'", () => {
      expect(normalizeInput("web developement")).toBe("Web Development");
    });

    it("corrects 'artifical intelligence' to 'Artificial Intelligence'", () => {
      expect(normalizeInput("artifical intelligence")).toBe("Artificial Intelligence");
    });

    it("corrects 'deep learing' to 'Deep Learning'", () => {
      expect(normalizeInput("deep learing")).toBe("Deep Learning");
    });
  });

  describe("synonym/abbreviation normalization", () => {
    it("normalizes 'ml' to 'Machine Learning'", () => {
      expect(normalizeInput("ml")).toBe("Machine Learning");
    });

    it("normalizes 'ai' to 'AI / ML'", () => {
      expect(normalizeInput("ai")).toBe("AI / ML");
    });

    it("normalizes 'ds' to 'Data Science'", () => {
      expect(normalizeInput("ds")).toBe("Data Science");
    });

    it("normalizes 'devops' to 'DevOps'", () => {
      expect(normalizeInput("devops")).toBe("DevOps");
    });

    it("normalizes 'oss' to 'Open Source'", () => {
      expect(normalizeInput("oss")).toBe("Open Source");
    });
  });

  describe("case normalization", () => {
    it("title-cases lowercase multi-word input", () => {
      expect(normalizeInput("machine learning")).toBe("Machine Learning");
    });

    it("preserves all-caps abbreviations", () => {
      expect(normalizeInput("AWS")).toBe("AWS");
      expect(normalizeInput("CI/CD")).toBe("CI/CD");
    });

    it("handles mixed case", () => {
      expect(normalizeInput("pYtHoN")).toBe("Python");
    });
  });

  describe("whitespace handling", () => {
    it("trims leading/trailing whitespace", () => {
      expect(normalizeInput("  Python  ")).toBe("Python");
    });

    it("handles empty string", () => {
      expect(normalizeInput("")).toBe("");
    });

    it("handles null/undefined", () => {
      expect(normalizeInput(null as any)).toBe("");
      expect(normalizeInput(undefined as any)).toBe("");
    });
  });

  describe("unknown values preserved (no over-correction)", () => {
    it("preserves unknown domain-specific terms", () => {
      expect(normalizeInput("quantum computing")).toBe("Quantum Computing");
    });

    it("preserves custom tool names", () => {
      expect(normalizeInput("my-custom-tool")).toBe("My-custom-tool");
    });

    it("preserves rare/niche interests without mapping to taxonomy", () => {
      expect(normalizeInput("bioinformatics")).toBe("Bioinformatics");
      expect(normalizeInput("computational linguistics")).toBe("Computational Linguistics");
      expect(normalizeInput("robotic process automation")).toBe("Robotic Process Automation");
    });

    it("does NOT map arbitrary text to unrelated taxonomy terms", () => {
      // 'rust' should not become 'Rust' (the language) if user meant something else
      // But 'rust' as a language IS correct — the function preserves case only
      expect(normalizeInput("rust")).toBe("Rust"); // Title-cased, not mapped
      expect(normalizeInput("blockchain")).toBe("Blockchain"); // Not mapped to anything
      expect(normalizeInput("web3")).toBe("Web3"); // Not in synonym map, just title-cased
    });
  });
});

describe("normalizeInputList", () => {
  it("splits comma-separated values", () => {
    const result = normalizeInputList("Python, Data Engineering, AI");
    expect(result).toEqual(["Python", "Data Engineering", "AI / ML"]);
  });

  it("handles typos in comma-separated list", () => {
    const result = normalizeInputList("pyhton, machne learning, data enginering");
    expect(result).toEqual(["Python", "Machine Learning", "Data Engineering"]);
  });

  it("trims whitespace around commas", () => {
    const result = normalizeInputList("  Python ,  Data Engineering  ");
    expect(result).toEqual(["Python", "Data Engineering"]);
  });

  it("filters empty entries", () => {
    const result = normalizeInputList("Python,, Data Engineering,");
    expect(result).toEqual(["Python", "Data Engineering"]);
  });

  it("handles empty input", () => {
    expect(normalizeInputList("")).toEqual([]);
    expect(normalizeInputList(null as any)).toEqual([]);
  });

  it("deduplicates after normalization", () => {
    const result = normalizeInputList("python, Python, PYTHON");
    expect(result).toEqual(["Python"]);
  });
});

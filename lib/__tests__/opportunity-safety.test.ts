import { describe, it, expect } from "vitest";
import { assessOpportunitySafety } from "@/lib/ingestion/opportunity-safety";

describe("assessOpportunitySafety — HIGH (blocked) patterns", () => {
  it("blocks a mandatory registration fee", () => {
    const r = assessOpportunitySafety({
      title: "Sales Intern",
      description: "Registration fee of ₹500 is mandatory to apply for this internship.",
      category: "Internship",
    });
    expect(r.level).toBe("blocked");
    expect(r.reasons).toContain("registration fee");
  });

  it("blocks a security deposit required from the candidate", () => {
    const r = assessOpportunitySafety({
      title: "Data Entry Intern",
      description: "A security deposit of ₹2,000 is required from candidates before joining.",
      category: "Internship",
    });
    expect(r.level).toBe("blocked");
    expect(r.reasons).toContain("security deposit");
  });

  it("blocks pay-to-join phrasing", () => {
    const r = assessOpportunitySafety({
      title: "Marketing Intern",
      description: "You need to pay ₹3,000 to join this internship.",
      category: "Internship",
    });
    expect(r.level).toBe("blocked");
  });

  it("blocks payment required after selection", () => {
    const r = assessOpportunitySafety({
      title: "Content Intern",
      description: "After selection, candidates must pay the training fee of ₹4,500.",
      category: "Internship",
    });
    expect(r.level).toBe("blocked");
  });

  it("blocks a guaranteed internship after purchasing a course", () => {
    const r = assessOpportunitySafety({
      title: "Software Intern",
      description: "Guaranteed internship after you purchase our ₹9,999 course.",
      category: "Internship",
    });
    expect(r.level).toBe("blocked");
    expect(r.reasons.some((x) => x.includes("guaranteed"))).toBe(true);
  });

  it("blocks a mandatory course fee", () => {
    const r = assessOpportunitySafety({
      title: "Design Intern",
      description: "Course fee is compulsory for all interns.",
      category: "Internship",
    });
    expect(r.level).toBe("blocked");
  });

  it("blocks candidate-pays training language", () => {
    const r = assessOpportunitySafety({
      title: "HR Intern",
      description: "You will pay for the training program before the internship starts.",
      category: "Internship",
    });
    expect(r.level).toBe("blocked");
  });
});

describe("assessOpportunitySafety — negation suppresses signals", () => {
  it("does NOT block when the fee is explicitly free", () => {
    const r = assessOpportunitySafety({
      title: "Sales Intern",
      description: "There is no registration fee. Join for free.",
      category: "Internship",
    });
    expect(r.level).toBe("clean");
  });

  it("does NOT block a waived deposit", () => {
    const r = assessOpportunitySafety({
      title: "Ops Intern",
      description: "The security deposit is waived for selected candidates.",
      category: "Internship",
    });
    expect(r.level).toBe("clean");
  });

  it("does NOT block a fee that is not applicable", () => {
    const r = assessOpportunitySafety({
      title: "Finance Intern",
      description: "Training fee is not applicable to this internship.",
      category: "Internship",
    });
    expect(r.level).toBe("clean");
  });
});

describe("assessOpportunitySafety — MEDIUM (review) patterns", () => {
  it("flags paid training for review but does not block", () => {
    const r = assessOpportunitySafety({
      title: "Analyst Intern",
      description: "Paid training program followed by an internship with us.",
      category: "Internship",
    });
    expect(r.level).toBe("review");
  });

  it("flags a course required before the internship", () => {
    const r = assessOpportunitySafety({
      title: "Web Intern",
      description: "Complete our web development course before joining the internship.",
      category: "Internship",
    });
    expect(r.level).toBe("review");
  });
});

describe("assessOpportunitySafety — LOW / clean text stays clean", () => {
  it("treats employer-paid stipend language as clean", () => {
    const r = assessOpportunitySafety({
      title: "Content Writing Intern",
      description: "Stipend ₹7,000 - ₹1,02,000/month. Duration: 3 Months. Start date: Immediately.",
      category: "Internship",
    });
    expect(r.level).toBe("clean");
  });

  it("treats training-provided language as clean", () => {
    const r = assessOpportunitySafety({
      title: "Sales Trainer L&D Intern",
      description: "Training will be provided. Certificate after internship.",
      category: "Internship",
    });
    expect(r.level).toBe("clean");
  });

  it("keeps the real Justdial L&D listing clean (observed false-positive fixture)", () => {
    const r = assessOpportunitySafety({
      title: "Sales Trainer L&D",
      description:
        "1. Assist the L&D team in planning and coordinating training programs for employees, such as NHT, refresher, process, or ad hoc. 2. Support trainers during classroom, virtual, and field training sessions.",
      category: "Internship",
    });
    expect(r.level).toBe("clean");
  });

  it("keeps employer-paid training phrasing clean (direction matters)", () => {
    const r = assessOpportunitySafety({
      title: "Marketing Intern",
      description: "We pay for the training of selected interns.",
      category: "Internship",
    });
    expect(r.level).toBe("clean");
  });
});

describe("assessOpportunitySafety — category gating", () => {
  it("does NOT block entry fees for events/hackathons", () => {
    const r = assessOpportunitySafety({
      title: "Hackathon Registration",
      description: "Registration fee of ₹500 for the hackathon.",
      category: "Hackathon",
    });
    expect(r.level).not.toBe("blocked");
  });

  it("still blocks job-like listings regardless of category label being absent", () => {
    const r = assessOpportunitySafety({
      title: "Intern",
      description: "Security deposit required to join.",
    });
    expect(r.level).toBe("blocked");
  });
});

describe("assessOpportunitySafety — robustness", () => {
  it("returns clean for empty input", () => {
    const r = assessOpportunitySafety({ title: null, description: null });
    expect(r.level).toBe("clean");
  });

  it("does not crash on long multi-paragraph descriptions", () => {
    const long = Array.from({ length: 50 }, (_, i) => `Paragraph ${i}: intern responsibilities include research and reporting.`).join("\n");
    const r = assessOpportunitySafety({ title: "Research Intern", description: long });
    expect(r.level).toBe("clean");
  });

  it("does not let a fee in one paragraph trigger unrelated text", () => {
    const r = assessOpportunitySafety({
      title: "Ops Intern",
      description:
        "We train employees on new processes. Candidates receive a monthly stipend.\nA registration fee is mandatory to apply.",
      category: "Internship",
    });
    expect(r.level).toBe("blocked"); // the fee sentence is still caught
  });
});
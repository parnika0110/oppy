import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { StaticProgramsSource } from "@/lib/ingestion/sources/static-programs";

const HACKMIT_DEADLINE_ISO = "2026-07-04T23:59:00-04:00";

describe("static-programs catalog — curator-verified deadlines", () => {
  it("emits the full verified shape for an entry WITH a catalog deadline", async () => {
    const source = new StaticProgramsSource();
    const items = await source.fetch();
    const hackmit = items.find((i) => i.title === "HackMIT");
    expect(hackmit).toBeDefined();
    expect(hackmit!.deadline instanceof Date).toBe(true);
    expect((hackmit!.deadline as Date).toISOString()).toBe(new Date(HACKMIT_DEADLINE_ISO).toISOString());
    expect(hackmit!.deadlineKind).toBe("verified");
    expect(hackmit!.applicationDeadline instanceof Date).toBe(true);
    expect((hackmit!.applicationDeadline as Date).toISOString()).toBe(new Date(HACKMIT_DEADLINE_ISO).toISOString());
    expect(hackmit!.deadlineLastVerifiedAt instanceof Date).toBe(true);
  });

  it("keeps null/unavailable for an entry WITHOUT a catalog deadline (never infers)", async () => {
    const source = new StaticProgramsSource();
    const items = await source.fetch();
    const gsoc = items.find((i) => i.title === "Google Summer of Code");
    expect(gsoc).toBeDefined();
    expect(gsoc!.deadline).toBeNull();
    expect(gsoc!.deadlineKind).toBe("unavailable");
    expect(gsoc!.applicationDeadline).toBeNull();
    expect(gsoc!.deadlineLastVerifiedAt).toBeNull();
  });

  it("deadlineDaysOut is NEVER used as a deadline", () => {
    const adapterCode = readFileSync("lib/ingestion/sources/static-programs.ts", "utf8");
    // No date arithmetic may ever derive a deadline from deadlineDaysOut.
    expect(adapterCode).not.toMatch(/deadlineDaysOut\s*\*/);
    expect(adapterCode).not.toMatch(/new Date\([^)]*deadlineDaysOut/);
    expect(adapterCode).not.toMatch(/setDate\([^)]*deadlineDaysOut/);
    // The field is documented as legacy metadata, not a deadline.
    expect(adapterCode).toContain("Not used as a deadline");
    // And the only deadline source in fetch() is the explicit catalog field:
    // entries without one must never carry a date.
    expect(adapterCode).toContain("deadline: program.deadline ? new Date(program.deadline) : null");
    expect(adapterCode).toContain('deadlineKind: program.deadline ? "verified" : "unavailable"');
  });

  it("only HackMIT carries a deadline across the whole catalog", async () => {
    const source = new StaticProgramsSource();
    const items = await source.fetch();
    const withDeadline = items.filter((i) => i.deadline || i.deadlineKind === "verified");
    expect(withDeadline.map((i) => i.title)).toEqual(["HackMIT"]);
  });

  it("Microsoft Imagine Cup is not in the catalog and gets no invented deadline", async () => {
    const source = new StaticProgramsSource();
    const items = await source.fetch();
    const imagine = items.find((i) => /imagine cup/i.test(i.title));
    expect(imagine).toBeUndefined(); // orphan DB record only — not seeded by the catalog
    // No entry may carry a fabricated date
    for (const item of items) {
      if (item.deadline) expect(item.deadlineKind).toBe("verified");
    }
  });
});

describe("seed.ts — catalog deadline handling", () => {
  const seedCode = readFileSync("scripts/seed.ts", "utf8");

  it("carries the HackMIT source-verified deadline", () => {
    expect(seedCode).toContain(`deadline: "${HACKMIT_DEADLINE_ISO}"`);
  });

  it("maps a catalog deadline to the verified shape on insert", () => {
    expect(seedCode).toContain('deadline: program.deadline ? new Date(program.deadline) : null');
    expect(seedCode).toContain('applicationDeadline: program.deadline ? new Date(program.deadline) : null');
    expect(seedCode).toContain('deadlineKind: program.deadline ? "verified" : "unavailable"');
  });

  it("does NOT null an existing verified deadline on update", () => {
    // Regression: the update path used to force deadline:null + unavailable.
    expect(seedCode).not.toMatch(/\$set:\s*\{\s*deadline:\s*null/);
    expect(seedCode).toContain("left untouched (never nulled");
  });

  it("keeps the never-manufacture safety principle wording", () => {
    expect(seedCode).toContain("Never manufacture a deadline we cannot verify; only use");
    expect(seedCode).toContain("curator-verified dates from the catalog");
  });

  it("does not add lifecycle reactivation to the seed update path", () => {
    // Keep the change minimal — the seed must not flip lifecycle state.
    expect(seedCode).not.toContain('update.lifecycleStatus = "active"');
    expect(seedCode).not.toContain('update.isActive = true');
    expect(seedCode).toContain("lifecycle state is never modified here");
  });
});
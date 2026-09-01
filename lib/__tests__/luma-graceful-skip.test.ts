/**
 * Regression: Luma source must be skipped gracefully when LUMA_CALENDARS is
 * not configured. The rest of the ingestion pipeline must continue unaffected.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCalendarSlugs, isLumaConfigured } from "@/lib/ingestion/sources/luma";

describe("Luma graceful skip when LUMA_CALENDARS is missing", () => {
  const originalEnv = process.env.LUMA_CALENDARS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.LUMA_CALENDARS;
    } else {
      process.env.LUMA_CALENDARS = originalEnv;
    }
  });

  it("returns empty array when LUMA_CALENDARS is unset", () => {
    delete process.env.LUMA_CALENDARS;
    expect(getCalendarSlugs()).toEqual([]);
    expect(isLumaConfigured()).toBe(false);
  });

  it("returns empty array when LUMA_CALENDARS is empty string", () => {
    process.env.LUMA_CALENDARS = "";
    expect(getCalendarSlugs()).toEqual([]);
    expect(isLumaConfigured()).toBe(false);
  });

  it("returns empty array when LUMA_CALENDARS is whitespace only", () => {
    process.env.LUMA_CALENDARS = "   ";
    expect(getCalendarSlugs()).toEqual([]);
    expect(isLumaConfigured()).toBe(false);
  });

  it("returns parsed slugs when LUMA_CALENDARS is set", () => {
    process.env.LUMA_CALENDARS = "buildclub,frontier-tower";
    expect(getCalendarSlugs()).toEqual(["buildclub", "frontier-tower"]);
    expect(isLumaConfigured()).toBe(true);
  });

  it("filters out empty entries from comma-separated list", () => {
    process.env.LUMA_CALENDARS = "buildclub,,frontier-tower,";
    expect(getCalendarSlugs()).toEqual(["buildclub", "frontier-tower"]);
    expect(isLumaConfigured()).toBe(true);
  });

  it("trims whitespace from slug entries", () => {
    process.env.LUMA_CALENDARS = " buildclub , frontier-tower ";
    expect(getCalendarSlugs()).toEqual(["buildclub", "frontier-tower"]);
  });
});

describe("Luma source fetch() returns empty when unconfigured", () => {
  const originalEnv = process.env.LUMA_CALENDARS;

  beforeEach(() => {
    delete process.env.LUMA_CALENDARS;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.LUMA_CALENDARS;
    } else {
      process.env.LUMA_CALENDARS = originalEnv;
    }
  });

  it("fetch() returns empty array when LUMA_CALENDARS is not set", async () => {
    // Dynamic import so the class sees the env state
    const { LumaSource } = await import("@/lib/ingestion/sources/luma");
    const source = new LumaSource();
    const result = await source.fetch();
    expect(result).toEqual([]);
  });

  it("fetch() does not throw when LUMA_CALENDARS is not set", async () => {
    const { LumaSource } = await import("@/lib/ingestion/sources/luma");
    const source = new LumaSource();
    await expect(source.fetch()).resolves.toBeDefined();
  });

  it("source metadata is correct", async () => {
    const { LumaSource } = await import("@/lib/ingestion/sources/luma");
    const source = new LumaSource();
    expect(source.name).toBe("Luma Events");
    expect(source.platform).toBe("Luma");
  });
});

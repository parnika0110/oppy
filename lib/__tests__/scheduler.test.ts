import { describe, it, expect } from "vitest";
import {
  getSourceInterval,
  getSourceIntervalLabel,
  isSourceOverdue,
  getNextRefreshAt,
  getSourceSchedule,
} from "../ingestion/scheduler";

describe("ingestion scheduler", () => {
  describe("getSourceInterval", () => {
    it("returns hourly interval for Hacker News", () => {
      expect(getSourceInterval("Hacker News Who's Hiring")).toBe(60 * 60 * 1000);
    });

    it("returns 7-day interval for JSearch (shared paid provider quota)", () => {
      expect(getSourceInterval("JSearch (LinkedIn/Indeed/Glassdoor/Naukri)")).toBe(7 * 24 * 60 * 60 * 1000);
      // Site-scoped JSearch-family adapters run at most monthly.
      expect(getSourceInterval("LinkedIn Jobs")).toBe(30 * 24 * 60 * 60 * 1000);
      expect(getSourceInterval("Indeed Jobs")).toBe(30 * 24 * 60 * 60 * 1000);
      expect(getSourceInterval("Glassdoor Jobs")).toBe(30 * 24 * 60 * 60 * 1000);
      expect(getSourceInterval("Wellfound (AngelList)")).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it("returns 4-hour interval for Internshala", () => {
      expect(getSourceInterval("Internshala")).toBe(4 * 60 * 60 * 1000);
    });

    it("returns 6-hour interval for Eventbrite", () => {
      expect(getSourceInterval("Eventbrite Events")).toBe(6 * 60 * 60 * 1000);
    });

    it("returns 12-hour interval for GitHub", () => {
      expect(getSourceInterval("GitHub")).toBe(12 * 60 * 60 * 1000);
    });

    it("returns default 6 hours for unknown source", () => {
      expect(getSourceInterval("Unknown Source")).toBe(6 * 60 * 60 * 1000);
    });
  });

  describe("getSourceIntervalLabel", () => {
    it("returns 'hourly' for Hacker News", () => {
      expect(getSourceIntervalLabel("Hacker News Who's Hiring")).toBe("hourly");
    });

    it("returns 'every 7 days' for JSearch", () => {
      expect(getSourceIntervalLabel("JSearch (LinkedIn/Indeed/Glassdoor/Naukri)")).toBe("every 7 days");
    });
  });

  describe("isSourceOverdue", () => {
    it("returns true when never run", () => {
      expect(isSourceOverdue("Hacker News Who's Hiring", null)).toBe(true);
    });

    it("returns true when last run was 2 hours ago for hourly source", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(isSourceOverdue("Hacker News Who's Hiring", twoHoursAgo)).toBe(true);
    });

    it("returns false when last run was 30 min ago for hourly source", () => {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      expect(isSourceOverdue("Hacker News Who's Hiring", thirtyMinAgo)).toBe(false);
    });

    it("returns false when last run was 1 day ago for 7-day source", () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      expect(isSourceOverdue("JSearch (LinkedIn/Indeed/Glassdoor/Naukri)", oneDayAgo)).toBe(false);
    });

    it("returns true when last run was 8 days ago for 7-day source", () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      expect(isSourceOverdue("JSearch (LinkedIn/Indeed/Glassdoor/Naukri)", eightDaysAgo)).toBe(true);
    });
  });

  describe("getNextRefreshAt", () => {
    it("returns null when never run (should run now)", () => {
      expect(getNextRefreshAt("Hacker News Who's Hiring", null)).toBeNull();
    });

    it("returns future date for hourly source run 30 min ago", () => {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const next = getNextRefreshAt("Hacker News Who's Hiring", thirtyMinAgo);
      expect(next).not.toBeNull();
      const nextDate = new Date(next!);
      expect(nextDate.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("getSourceSchedule", () => {
    it("returns array of source schedules", () => {
      const schedule = getSourceSchedule();
      expect(schedule.length).toBeGreaterThan(10);
      expect(schedule.every(s => s.name && s.intervalMs > 0 && s.intervalLabel)).toBe(true);
    });

    it("includes all major source categories", () => {
      const schedule = getSourceSchedule();
      const names = schedule.map(s => s.name);
      expect(names).toContain("Hacker News Who's Hiring");
      expect(names).toContain("Internshala");
      expect(names).toContain("Eventbrite Events");
      expect(names).toContain("GitHub");
    });
  });
});

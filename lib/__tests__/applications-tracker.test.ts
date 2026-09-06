import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const routeCode = readFileSync("app/dashboard/applications/page.tsx", "utf8");
const navCode = readFileSync("components/Nav.tsx", "utf8");
const trackerCode = readFileSync("components/TrackingDashboard.tsx", "utf8");

describe("centralized applications tracker — route", () => {
  it("is server-guarded: redirects unauthenticated users to login with the return path preserved", () => {
    expect(routeCode).toContain("getCurrentUser()");
    expect(routeCode).toContain('redirect("/login?next=/dashboard/applications")');
  });

  it("renders the shared TrackingDashboard in standalone mode", () => {
    expect(routeCode).toContain("import TrackingDashboard");
    expect(routeCode).toContain("<TrackingDashboard standalone />");
  });

  it("has page metadata", () => {
    expect(routeCode).toContain("Applications · OPPY");
  });
});

describe("centralized applications tracker — navigation", () => {
  it("adds an Applications link to the authenticated nav", () => {
    expect(navCode).toContain('href="/dashboard/applications"');
    expect(navCode).toContain("Applications");
  });
});

describe("centralized applications tracker — TrackingDashboard behavior", () => {
  it("accepts a standalone prop that forces the empty state to render", () => {
    expect(trackerCode).toContain("standalone = false");
    expect(trackerCode).toContain("if (!standalone && !loading && entries.length === 0) return null;");
  });

  it("shows a graceful empty state with a Browse CTA", () => {
    expect(trackerCode).toContain("Nothing tracked yet.");
    expect(trackerCode).toContain("Browse opportunities →");
  });

  it("shows a View all link when embedded on the dashboard", () => {
    expect(trackerCode).toContain('href="/dashboard/applications"');
    expect(trackerCode).toContain("View all →");
    expect(trackerCode).toContain("{!standalone && entries.length > 0 && (");
  });

  it("marks closed/archived opportunities as not actionable but keeps them in history", () => {
    expect(trackerCode).toContain("isNotActionable");
    expect(trackerCode).toContain('opp.lifecycleStatus === "closed" || opp.lifecycleStatus === "archived" || opp.isActive === false');
    expect(trackerCode).toContain('{opp.lifecycleStatus === "archived" ? "Archived" : "Closed"}');
    // History is never deleted: the row still links to the opportunity
    expect(trackerCode).toContain('href={`/opportunity/${opp._id}`}');
  });

  it("still updates status through the existing tracking API", () => {
    expect(trackerCode).toContain('<ApplicationTracker');
    expect(trackerCode).toContain("onStatusChange");
  });

  it("shows a verified application deadline when available", () => {
    expect(trackerCode).toContain('["verified", "source_provided"].includes(kind || "")');
    expect(trackerCode).toContain("Deadline: {deadlineLabel(opp)}");
  });
});
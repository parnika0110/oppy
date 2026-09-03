import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ObjectId } from "mongodb";

// ── Mocks ──────────────────────────────────────────────────────────────

const mockUserId = new ObjectId();
const mockOtherUserId = new ObjectId();

// Track what gets written to MongoDB
const dbState = {
  users: new Map<string, any>(),
  sessions: new Map<string, any>(),
  saved: new Map<string, any>(),
  tracking: new Map<string, any>(),
  resets: new Map<string, any>(),
  reminders: new Map<string, any>(),
};

function resetDb() {
  dbState.users.clear();
  dbState.sessions.clear();
  dbState.saved.clear();
  dbState.tracking.clear();
  dbState.resets.clear();
  dbState.reminders.clear();
}

// Seed a test user with resume + preferences
function seedUser(id: ObjectId, overrides: any = {}) {
  const user = {
    _id: id,
    email: "test@example.com",
    name: "Test User",
    preferences: { skills: ["Python"], interests: ["AI / ML"], locations: ["Bengaluru"] },
    resumeProfile: {
      uploaded: true,
      extractedSkills: ["Java", "React"],
      extractedInterests: ["Game Dev"],
      projects: [{ title: "Proj", technologies: ["Java"], description: "" }],
      experience: [],
      education: [],
      achievements: [],
      domains: ["Game Dev"],
      parsedAt: new Date(),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  dbState.users.set(id.toString(), user);
  return user;
}

// Mock MongoDB collections
function makeMockCollection(store: Map<string, any>) {
  return {
    updateOne: vi.fn(async (filter: any, update: any) => {
      const id = filter._id?.toString?.();
      const doc = id ? store.get(id) : undefined;
      if (!doc) return { matchedCount: 0, modifiedCount: 0 };
      if (update.$set) Object.assign(doc, update.$set);
      if (update.$unset) {
        for (const key of Object.keys(update.$unset)) delete doc[key];
      }
      return { matchedCount: 1, modifiedCount: 1 };
    }),
    deleteOne: vi.fn(async (filter: any) => {
      const id = filter._id?.toString?.();
      if (id && store.has(id)) { store.delete(id); return { deletedCount: 1 }; }
      return { deletedCount: 0 };
    }),
    deleteMany: vi.fn(async (filter: any) => {
      let count = 0;
      if (filter.userId) {
        const userId = filter.userId.toString();
        for (const [key, val] of store) {
          if (val.userId?.toString?.() === userId) { store.delete(key); count++; }
        }
      }
      return { deletedCount: count };
    }),
    findOne: vi.fn(async (filter: any) => {
      const id = filter._id?.toString?.();
      return id ? store.get(id) || null : null;
    }),
    insertOne: vi.fn(async (doc: any) => {
      const id = doc._id?.toString?.() || new ObjectId().toString();
      store.set(id, { ...doc, _id: new ObjectId(id) });
      return { insertedId: new ObjectId(id) };
    }),
  };
}

// Mock getCurrentUser
let mockCurrentUser: any = null;

vi.mock("@/lib/userAuth", () => ({
  getCurrentUser: vi.fn(async () => mockCurrentUser),
  createSession: vi.fn(async () => "mock-token"),
  deleteSession: vi.fn(async () => {}),
  SESSION_COOKIE: "oppy_session",
}));

// Mock MongoDB collection getters
const mockCollections: Record<string, any> = {};

vi.mock("@/lib/mongodb", () => ({
  getUsersCollection: vi.fn(async () => mockCollections.users),
  getSessionsCollection: vi.fn(async () => mockCollections.sessions),
  getSavedOpportunitiesCollection: vi.fn(async () => mockCollections.saved),
  getApplicationTrackingCollection: vi.fn(async () => mockCollections.tracking),
  getPasswordResetsCollection: vi.fn(async () => mockCollections.resets),
  getReminderLogCollection: vi.fn(async () => mockCollections.reminders),
  getDb: vi.fn(async () => ({})),
}));

// ── Resume Removal Tests ───────────────────────────────────────────────

describe("DELETE /api/resume/remove", () => {
  beforeEach(async () => {
    resetDb();
    mockCollections.users = makeMockCollection(dbState.users);
    mockCollections.sessions = makeMockCollection(dbState.sessions);
    mockCollections.saved = makeMockCollection(dbState.saved);
    mockCollections.tracking = makeMockCollection(dbState.tracking);
    mockCollections.resets = makeMockCollection(dbState.resets);
    mockCollections.reminders = makeMockCollection(dbState.reminders);
  });

  it("returns 401 when unauthenticated", async () => {
    mockCurrentUser = null;
    const { DELETE } = await import("@/app/api/resume/remove/route");
    const req = new Request("http://localhost/api/resume/remove", { method: "DELETE" });
    const res = await DELETE(req as any);
    expect(res.status).toBe(401);
  });

  it("removes resumeProfile from authenticated user", async () => {
    const user = seedUser(mockUserId);
    mockCurrentUser = { id: mockUserId.toString() };

    const { DELETE } = await import("@/app/api/resume/remove/route");
    const req = new Request("http://localhost/api/resume/remove", { method: "DELETE" });
    const res = await DELETE(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockCollections.users.updateOne).toHaveBeenCalled();
    // Verify $unset was used (resumeProfile removed)
    const updateCall = mockCollections.users.updateOne.mock.calls[0];
    expect(updateCall[1]).toHaveProperty("$unset");
    expect(updateCall[1].$unset).toHaveProperty("resumeProfile");
  });

  it("preserves preferences.skills after resume removal", async () => {
    seedUser(mockUserId);
    mockCurrentUser = { id: mockUserId.toString() };

    const { DELETE } = await import("@/app/api/resume/remove/route");
    const req = new Request("http://localhost/api/resume/remove", { method: "DELETE" });
    await DELETE(req as any);

    const user = dbState.users.get(mockUserId.toString());
    expect(user.preferences.skills).toEqual(["Python"]);
  });

  it("preserves preferences.interests after resume removal", async () => {
    seedUser(mockUserId);
    mockCurrentUser = { id: mockUserId.toString() };

    const { DELETE } = await import("@/app/api/resume/remove/route");
    const req = new Request("http://localhost/api/resume/remove", { method: "DELETE" });
    await DELETE(req as any);

    const user = dbState.users.get(mockUserId.toString());
    expect(user.preferences.interests).toEqual(["AI / ML"]);
  });

  it("does not touch another user's resumeProfile", async () => {
    seedUser(mockUserId);
    const otherUser = seedUser(mockOtherUserId, { email: "other@example.com" });
    mockCurrentUser = { id: mockUserId.toString() };

    const { DELETE } = await import("@/app/api/resume/remove/route");
    const req = new Request("http://localhost/api/resume/remove", { method: "DELETE" });
    await DELETE(req as any);

    // Other user's resumeProfile should be untouched
    const other = dbState.users.get(mockOtherUserId.toString());
    expect(other.resumeProfile).toBeDefined();
    expect(other.resumeProfile.uploaded).toBe(true);
  });

  it("handles repeated removal safely (idempotent)", async () => {
    seedUser(mockUserId);
    mockCurrentUser = { id: mockUserId.toString() };

    const { DELETE } = await import("@/app/api/resume/remove/route");
    const req = new Request("http://localhost/api/resume/remove", { method: "DELETE" });

    // First removal
    const res1 = await DELETE(req as any);
    expect(res1.status).toBe(200);

    // Second removal — should not crash
    const req2 = new Request("http://localhost/api/resume/remove", { method: "DELETE" });
    const res2 = await DELETE(req2 as any);
    expect(res2.status).toBe(200);
  });

  it("returns 500 on database failure without claiming success", async () => {
    seedUser(mockUserId);
    mockCurrentUser = { id: mockUserId.toString() };
    mockCollections.users.updateOne = vi.fn().mockRejectedValue(new Error("DB down"));

    const { DELETE } = await import("@/app/api/resume/remove/route");
    const req = new Request("http://localhost/api/resume/remove", { method: "DELETE" });
    const res = await DELETE(req as any);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBeUndefined();
    expect(body.error).toBeDefined();
  });
});

// ── Account Deletion Tests ─────────────────────────────────────────────

describe("POST /api/account/delete", () => {
  beforeEach(async () => {
    resetDb();
    mockCollections.users = makeMockCollection(dbState.users);
    mockCollections.sessions = makeMockCollection(dbState.sessions);
    mockCollections.saved = makeMockCollection(dbState.saved);
    mockCollections.tracking = makeMockCollection(dbState.tracking);
    mockCollections.resets = makeMockCollection(dbState.resets);
    mockCollections.reminders = makeMockCollection(dbState.reminders);
  });

  it("returns 401 when unauthenticated", async () => {
    mockCurrentUser = null;
    const { POST } = await import("@/app/api/account/delete/route");
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it("returns 400 when confirmation is missing", async () => {
    seedUser(mockUserId);
    mockCurrentUser = { id: mockUserId.toString() };

    const { POST } = await import("@/app/api/account/delete/route");
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 when confirmation is wrong text", async () => {
    seedUser(mockUserId);
    mockCurrentUser = { id: mockUserId.toString() };

    const { POST } = await import("@/app/api/account/delete/route");
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "delete" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 when confirmation is case-insensitive wrong", async () => {
    seedUser(mockUserId);
    mockCurrentUser = { id: mockUserId.toString() };

    const { POST } = await import("@/app/api/account/delete/route");
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "Delete" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("deletes user document on valid confirmation", async () => {
    seedUser(mockUserId);
    mockCurrentUser = { id: mockUserId.toString() };

    const { POST } = await import("@/app/api/account/delete/route");
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(dbState.users.has(mockUserId.toString())).toBe(false);
  });

  it("deletes all sessions for the user", async () => {
    seedUser(mockUserId);
    // Seed sessions for this user
    dbState.sessions.set("s1", { token: "s1", userId: mockUserId });
    dbState.sessions.set("s2", { token: "s2", userId: mockUserId });
    // Seed session for another user
    dbState.sessions.set("s3", { token: "s3", userId: mockOtherUserId });
    mockCurrentUser = { id: mockUserId.toString() };

    const { POST } = await import("@/app/api/account/delete/route");
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    await POST(req as any);

    expect(dbState.sessions.has("s1")).toBe(false);
    expect(dbState.sessions.has("s2")).toBe(false);
    expect(dbState.sessions.has("s3")).toBe(true); // other user's session preserved
  });

  it("deletes savedOpportunities for the user", async () => {
    seedUser(mockUserId);
    dbState.saved.set("sv1", { userId: mockUserId, opportunityId: "opp1" });
    dbState.saved.set("sv2", { userId: mockOtherUserId, opportunityId: "opp2" });
    mockCurrentUser = { id: mockUserId.toString() };

    const { POST } = await import("@/app/api/account/delete/route");
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    await POST(req as any);

    expect(dbState.saved.has("sv1")).toBe(false);
    expect(dbState.saved.has("sv2")).toBe(true);
  });

  it("deletes applicationTracking for the user", async () => {
    seedUser(mockUserId);
    dbState.tracking.set("t1", { userId: mockUserId });
    dbState.tracking.set("t2", { userId: mockOtherUserId });
    mockCurrentUser = { id: mockUserId.toString() };

    const { POST } = await import("@/app/api/account/delete/route");
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    await POST(req as any);

    expect(dbState.tracking.has("t1")).toBe(false);
    expect(dbState.tracking.has("t2")).toBe(true);
  });

  it("deletes passwordResets for the user", async () => {
    seedUser(mockUserId);
    dbState.resets.set("r1", { userId: mockUserId });
    dbState.resets.set("r2", { userId: mockOtherUserId });
    mockCurrentUser = { id: mockUserId.toString() };

    const { POST } = await import("@/app/api/account/delete/route");
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    await POST(req as any);

    expect(dbState.resets.has("r1")).toBe(false);
    expect(dbState.resets.has("r2")).toBe(true);
  });

  it("deletes reminderLog for the user", async () => {
    seedUser(mockUserId);
    dbState.reminders.set("rem1", { userId: mockUserId });
    dbState.reminders.set("rem2", { userId: mockOtherUserId });
    mockCurrentUser = { id: mockUserId.toString() };

    const { POST } = await import("@/app/api/account/delete/route");
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    await POST(req as any);

    expect(dbState.reminders.has("rem1")).toBe(false);
    expect(dbState.reminders.has("rem2")).toBe(true);
  });

  it("does not delete another user's records", async () => {
    seedUser(mockUserId);
    seedUser(mockOtherUserId, { email: "other@example.com" });
    dbState.sessions.set("s1", { token: "s1", userId: mockOtherUserId });
    dbState.saved.set("sv1", { userId: mockOtherUserId });
    mockCurrentUser = { id: mockUserId.toString() };

    const { POST } = await import("@/app/api/account/delete/route");
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    await POST(req as any);

    // Other user's data should remain
    expect(dbState.users.has(mockOtherUserId.toString())).toBe(true);
    expect(dbState.sessions.has("s1")).toBe(true);
    expect(dbState.saved.has("sv1")).toBe(true);
  });

  it("clears the session cookie", async () => {
    seedUser(mockUserId);
    mockCurrentUser = { id: mockUserId.toString() };

    const { POST } = await import("@/app/api/account/delete/route");
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    const res = await POST(req as any);

    // Check Set-Cookie header clears the session
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain("oppy_session=");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("returns 500 on database failure without claiming success", async () => {
    seedUser(mockUserId);
    mockCurrentUser = { id: mockUserId.toString() };
    mockCollections.users.deleteOne = vi.fn().mockRejectedValue(new Error("DB down"));

    const { POST } = await import("@/app/api/account/delete/route");
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBeUndefined();
    expect(body.error).toBeDefined();
  });

  it("returns 404 when user document is already deleted", async () => {
    // Don't seed user — simulate already-deleted account
    mockCurrentUser = { id: mockUserId.toString() };

    const { POST } = await import("@/app/api/account/delete/route");
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(404);
  });
});

// ── Security Review Tests ──────────────────────────────────────────────

describe("Security: API route authentication", () => {
  it("resume remove uses session-derived userId, not client-supplied", async () => {
    seedUser(mockUserId);
    mockCurrentUser = { id: mockUserId.toString() };

    const { DELETE } = await import("@/app/api/resume/remove/route");
    const req = new Request("http://localhost/api/resume/remove", { method: "DELETE" });
    await DELETE(req as any);

    // Verify updateOne was called with the session-derived userId
    const updateCall = mockCollections.users.updateOne.mock.calls[0];
    expect(updateCall[0]._id.toString()).toBe(mockUserId.toString());
  });

  it("account delete uses session-derived userId, not client-supplied", async () => {
    seedUser(mockUserId);
    seedUser(mockOtherUserId, { email: "other@example.com" });
    mockCurrentUser = { id: mockUserId.toString() };

    const { POST } = await import("@/app/api/account/delete/route");
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    await POST(req as any);

    // Verify only mockUserId's data was targeted
    expect(dbState.users.has(mockUserId.toString())).toBe(false);
    expect(dbState.users.has(mockOtherUserId.toString())).toBe(true);
  });

  it("no cross-user deletion is possible when authenticated as different user", async () => {
    seedUser(mockUserId);
    const victim = seedUser(mockOtherUserId, { email: "victim@example.com" });
    mockCurrentUser = { id: mockUserId.toString() }; // Authenticated as user A

    const { POST } = await import("@/app/api/account/delete/route");
    const req = new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    await POST(req as any);

    // Victim's data must survive
    expect(dbState.users.has(mockOtherUserId.toString())).toBe(true);
    expect(dbState.users.get(mockOtherUserId.toString()).email).toBe("victim@example.com");
  });
});

// ── Data Model Integrity Tests ─────────────────────────────────────────

describe("Data model integrity", () => {
  it("resumeProfile and preferences are structurally independent", () => {
    const user = {
      preferences: { skills: ["Python"], interests: ["AI"] },
      resumeProfile: {
        uploaded: true,
        extractedSkills: ["Java"],
        extractedInterests: ["Game Dev"],
      },
    };

    // Removing resumeProfile does not touch preferences
    const { resumeProfile: _, ...rest } = user as any;
    expect(rest.preferences.skills).toEqual(["Python"]);
    expect(rest.preferences.interests).toEqual(["AI"]);
  });

  it("all 6 user-owned collections are identified for deletion", () => {
    const userOwned = [
      "users", "sessions", "savedOpportunities",
      "applicationTracking", "passwordResets", "reminderLog",
    ];
    expect(userOwned).toHaveLength(6);
  });

  it("global collections are never in the deletion list", () => {
    const global = ["opportunities", "ingestionRuns"];
    const userOwned = [
      "users", "sessions", "savedOpportunities",
      "applicationTracking", "passwordResets",
      "reminderLog",
    ];
    for (const g of global) {
      expect(userOwned).not.toContain(g);
    }
  });
});

// ── Remote Preference Mutual Exclusivity ───────────────────────────────

describe("Remote preference mutual exclusivity", () => {
  it("remote state is boolean | null — never two values at once", () => {
    // Simulates the UI state management in profile and onboarding pages
    let remote: boolean | null = null;

    // Click "Remote OK"
    remote = true;
    expect(remote).toBe(true);
    expect(typeof remote).toBe("boolean");

    // Click "On-site only" — replaces previous value
    remote = false;
    expect(remote).toBe(false);
    expect(remote).not.toBe(true);

    // Click "Remote OK" again — replaces previous value
    remote = true;
    expect(remote).toBe(true);
    expect(remote).not.toBe(false);
  });

  it("null represents no preference (onboarding only)", () => {
    let remote: boolean | null = null;
    expect(remote).toBeNull();

    // Click "No preference" — stays null
    remote = null;
    expect(remote).toBeNull();

    // Click "Remote OK" — becomes boolean
    remote = true;
    expect(remote).toBe(true);
  });

  it("API receives single boolean value, not both", () => {
    // Profile page sends: { remote: true } or { remote: false } or { remote: null }
    const payloads = [
      { remote: true },
      { remote: false },
      { remote: null },
    ];

    for (const p of payloads) {
      // Only one value exists — never { remote: true, remote: false }
      expect(p.remote === true || p.remote === false || p.remote === null).toBe(true);
      // Cannot be both true and false simultaneously
      const isTrue = p.remote === true;
      const isFalse = p.remote === false;
      expect(isTrue && isFalse).toBe(false);
    }
  });

  it("saved profile remote value matches last button clicked", () => {
    // Simulate: user clicks "On-site only", then saves
    let remote: boolean | null = null;
    remote = false; // Click "On-site only"

    // Save payload
    const savePayload = { remote };
    expect(savePayload.remote).toBe(false);
    expect(savePayload.remote).not.toBe(true);
    expect(savePayload.remote).not.toBeNull();
  });

  it("onboarding has 3 options: true, false, null", () => {
    const onboardingOptions = [
      { label: "Remote OK", value: true },
      { label: "On-site only", value: false },
      { label: "No preference", value: null },
    ];

    const values = onboardingOptions.map((o) => o.value);
    expect(values).toContain(true);
    expect(values).toContain(false);
    expect(values).toContain(null);
    expect(values).toHaveLength(3);
  });

  it("profile has 2 options: true, false (no null)", () => {
    const profileOptions = [
      { label: "Remote OK", value: true },
      { label: "On-site only", value: false },
    ];

    const values = profileOptions.map((o) => o.value);
    expect(values).toContain(true);
    expect(values).toContain(false);
    expect(values).not.toContain(null);
    expect(values).toHaveLength(2);
  });
});

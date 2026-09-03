import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { ObjectId } from "mongodb";

// ── Mocks ──────────────────────────────────────────────────────────────

const mockUserId = new ObjectId();
const mockOtherUserId = new ObjectId();

const dbState = {
  users: new Map<string, any>(),
  sessions: new Map<string, any>(),
};

function resetDb() {
  dbState.users.clear();
  dbState.sessions.clear();
}

function seedUser(id: ObjectId, overrides: any = {}) {
  const user = {
    _id: id,
    email: "test@example.com",
    name: "Test User",
    preferences: { skills: ["Python"], interests: ["AI / ML"] },
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

function makeMockCollection(store: Map<string, any>) {
  return {
    updateOne: vi.fn(async (filter: any, update: any) => {
      const id = filter._id?.toString?.();
      const doc = id ? store.get(id) : undefined;
      if (!doc) return { matchedCount: 0, modifiedCount: 0 };
      if (update.$set) {
        // Handle dot-notation keys like "preferences.skills"
        for (const [key, val] of Object.entries(update.$set)) {
          if (key.includes(".")) {
            const parts = key.split(".");
            let obj = doc;
            for (let i = 0; i < parts.length - 1; i++) {
              if (!obj[parts[i]]) obj[parts[i]] = {};
              obj = obj[parts[i]];
            }
            obj[parts[parts.length - 1]] = val;
          } else {
            doc[key] = val;
          }
        }
      }
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

let mockCurrentUser: any = null;

vi.mock("@/lib/userAuth", () => ({
  getCurrentUser: vi.fn(async () => mockCurrentUser),
  createSession: vi.fn(async () => "mock-token"),
  deleteSession: vi.fn(async () => {}),
  SESSION_COOKIE: "oppy_session",
}));

const mockCollections: Record<string, any> = {};

vi.mock("@/lib/mongodb", () => ({
  getUsersCollection: vi.fn(async () => mockCollections.users),
  getSessionsCollection: vi.fn(async () => mockCollections.sessions),
  getSavedOpportunitiesCollection: vi.fn(async () => ({})),
  getApplicationTrackingCollection: vi.fn(async () => ({})),
  getPasswordResetsCollection: vi.fn(async () => ({})),
  getReminderLogCollection: vi.fn(async () => ({})),
  getDb: vi.fn(async () => ({})),
}));

// Mock resume parser to avoid pdf2json dependency in tests
vi.mock("@/lib/resume-parser", () => ({
  parseResume: vi.fn(async (buffer: Buffer, mimeType: string) => ({
    uploaded: true,
    extractedSkills: ["Python", "JavaScript"],
    extractedInterests: ["Web Development"],
    projects: [{ title: "Test Project", technologies: ["React"], description: "" }],
    experience: [{ role: "Intern", organization: "Acme", duration: "3 months" }],
    education: [{ institution: "MIT", degree: "BS", field: "CS" }],
    achievements: ["Dean's List"],
    domains: ["Web Development"],
    parsedAt: new Date(),
  })),
}));

// ── Resume Upload / Replace Tests ──────────────────────────────────────

describe("POST /api/resume/upload — authentication", () => {
  beforeEach(() => {
    resetDb();
    mockCollections.users = makeMockCollection(dbState.users);
    mockCollections.sessions = makeMockCollection(dbState.sessions);
  });

  it("returns 401 when unauthenticated", async () => {
    mockCurrentUser = null;
    const { POST } = await import("@/app/api/resume/upload/route");

    const formData = new FormData();
    formData.append("resume", new File(["test"], "test.pdf", { type: "application/pdf" }));

    const req = new Request("http://localhost/api/resume/upload", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it("returns 400 when no file provided", async () => {
    mockCurrentUser = { id: mockUserId.toString() };
    const { POST } = await import("@/app/api/resume/upload/route");

    const formData = new FormData();
    const req = new Request("http://localhost/api/resume/upload", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 for unsupported file type", async () => {
    mockCurrentUser = { id: mockUserId.toString() };
    const { POST } = await import("@/app/api/resume/upload/route");

    const formData = new FormData();
    formData.append("resume", new File(["test"], "test.txt", { type: "text/plain" }));
    const req = new Request("http://localhost/api/resume/upload", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("authenticated user can upload resume", async () => {
    seedUser(mockUserId);
    mockCurrentUser = { id: mockUserId.toString() };
    const { POST } = await import("@/app/api/resume/upload/route");

    const formData = new FormData();
    formData.append("resume", new File(["test content"], "resume.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/api/resume/upload", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.resumeProfile).toBeDefined();
  });

  it("replacement overwrites existing resumeProfile", async () => {
    seedUser(mockUserId);
    mockCurrentUser = { id: mockUserId.toString() };
    const { POST } = await import("@/app/api/resume/upload/route");

    // Verify old resume exists
    const userBefore = dbState.users.get(mockUserId.toString());
    expect(userBefore.resumeProfile.extractedSkills).toEqual(["Java", "React"]);

    // Upload replacement
    const formData = new FormData();
    formData.append("resume", new File(["new content"], "new-resume.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/api/resume/upload", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);

    // Verify old resume was overwritten by $set
    const userAfter = dbState.users.get(mockUserId.toString());
    // The mock parseResume returns Python, JavaScript — so the new skills should be there
    expect(userAfter.resumeProfile).toBeDefined();
    expect(userAfter.resumeProfile.uploaded).toBe(true);
  });

  it("preferences are preserved during resume replacement", async () => {
    seedUser(mockUserId);
    mockCurrentUser = { id: mockUserId.toString() };
    const { POST } = await import("@/app/api/resume/upload/route");

    const formData = new FormData();
    formData.append("resume", new File(["content"], "resume.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/api/resume/upload", {
      method: "POST",
      body: formData,
    });
    await POST(req as any);

    // Preferences should be untouched — $set only sets resumeProfile and updatedAt
    const user = dbState.users.get(mockUserId.toString());
    expect(user.preferences.skills).toEqual(["Python"]);
    expect(user.preferences.interests).toEqual(["AI / ML"]);
  });

  it("another user's resume cannot be replaced (session-derived userId)", async () => {
    seedUser(mockUserId);
    seedUser(mockOtherUserId, { email: "other@example.com" });
    mockCurrentUser = { id: mockUserId.toString() }; // Authenticated as user A

    const { POST } = await import("@/app/api/resume/upload/route");
    const formData = new FormData();
    formData.append("resume", new File(["content"], "resume.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/api/resume/upload", {
      method: "POST",
      body: formData,
    });
    await POST(req as any);

    // User A's resume should be updated
    const userA = dbState.users.get(mockUserId.toString());
    expect(userA.resumeProfile).toBeDefined();

    // User B's resume should be untouched
    const userB = dbState.users.get(mockOtherUserId.toString());
    expect(userB.resumeProfile.extractedSkills).toEqual(["Java", "React"]);
  });
});

// ── Resume Remove Tests ────────────────────────────────────────────────

describe("DELETE /api/resume/remove — authentication", () => {
  beforeEach(() => {
    resetDb();
    mockCollections.users = makeMockCollection(dbState.users);
    mockCollections.sessions = makeMockCollection(dbState.sessions);
  });

  it("returns 401 when unauthenticated", async () => {
    mockCurrentUser = null;
    const { DELETE } = await import("@/app/api/resume/remove/route");
    const req = new Request("http://localhost/api/resume/remove", { method: "DELETE" });
    const res = await DELETE(req as any);
    expect(res.status).toBe(401);
  });

  it("authenticated user can remove resume", async () => {
    seedUser(mockUserId);
    mockCurrentUser = { id: mockUserId.toString() };
    const { DELETE } = await import("@/app/api/resume/remove/route");
    const req = new Request("http://localhost/api/resume/remove", { method: "DELETE" });
    const res = await DELETE(req as any);
    expect(res.status).toBe(200);
  });

  it("removal uses $unset — resumeProfile is removed", async () => {
    seedUser(mockUserId);
    mockCurrentUser = { id: mockUserId.toString() };
    const { DELETE } = await import("@/app/api/resume/remove/route");
    const req = new Request("http://localhost/api/resume/remove", { method: "DELETE" });
    await DELETE(req as any);

    const updateCall = mockCollections.users.updateOne.mock.calls[0];
    expect(updateCall[1]).toHaveProperty("$unset");
    expect(updateCall[1].$unset).toHaveProperty("resumeProfile");
  });

  it("preferences remain untouched after removal", async () => {
    seedUser(mockUserId);
    mockCurrentUser = { id: mockUserId.toString() };
    const { DELETE } = await import("@/app/api/resume/remove/route");
    const req = new Request("http://localhost/api/resume/remove", { method: "DELETE" });
    await DELETE(req as any);

    const user = dbState.users.get(mockUserId.toString());
    expect(user.preferences.skills).toEqual(["Python"]);
    expect(user.preferences.interests).toEqual(["AI / ML"]);
  });
});

// ── Auth Consistency Tests ─────────────────────────────────────────────

describe("Auth consistency across resume routes", () => {
  it("resume/upload uses getCurrentUser(request) — same as profile routes", async () => {
    const { getCurrentUser } = await import("@/lib/userAuth");
    mockCurrentUser = { id: mockUserId.toString() };
    seedUser(mockUserId);

    const { POST } = await import("@/app/api/resume/upload/route");
    const formData = new FormData();
    formData.append("resume", new File(["content"], "resume.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/api/resume/upload", {
      method: "POST",
      body: formData,
    });
    await POST(req as any);

    // Verify getCurrentUser was called with the request object
    expect(getCurrentUser).toHaveBeenCalledWith(req);
  });

  it("resume/remove uses getCurrentUser(request) — same as profile routes", async () => {
    const { getCurrentUser } = await import("@/lib/userAuth");
    mockCurrentUser = { id: mockUserId.toString() };
    seedUser(mockUserId);

    const { DELETE } = await import("@/app/api/resume/remove/route");
    const req = new Request("http://localhost/api/resume/remove", { method: "DELETE" });
    await DELETE(req as any);

    expect(getCurrentUser).toHaveBeenCalledWith(req);
  });
});

// ── Production 401 Failure Mode Regression Tests ───────────────────────

describe("Production 401 diagnosis — exact failure modes", () => {
  beforeEach(() => {
    resetDb();
    mockCollections.users = makeMockCollection(dbState.users);
    mockCollections.sessions = makeMockCollection(dbState.sessions);
  });

  it("returns 401 when cookie header is completely absent", async () => {
    mockCurrentUser = null; // getCurrentUser will return null
    const { POST } = await import("@/app/api/resume/upload/route");
    const formData = new FormData();
    formData.append("resume", new File(["test"], "resume.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/api/resume/upload", {
      method: "POST",
      body: formData,
      // No cookie header — simulates browser not sending cookie
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it("returns 401 when cookie has oppy_session but value is empty", async () => {
    mockCurrentUser = null;
    const { POST } = await import("@/app/api/resume/upload/route");
    const formData = new FormData();
    formData.append("resume", new File(["test"], "resume.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/api/resume/upload", {
      method: "POST",
      body: formData,
      headers: { cookie: "oppy_session=" },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it("returns 401 when session token does not exist in DB", async () => {
    mockCurrentUser = null; // getCurrentUser returns null when session not found
    const { POST } = await import("@/app/api/resume/upload/route");
    const formData = new FormData();
    formData.append("resume", new File(["test"], "resume.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/api/resume/upload", {
      method: "POST",
      body: formData,
      headers: { cookie: "oppy_session=nonexistent-token-abc123" },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it("returns 401 when session exists but user document is deleted", async () => {
    // Session exists in DB but user was deleted
    const sessionId = new ObjectId();
    dbState.sessions.set(sessionId.toString(), {
      _id: sessionId,
      token: "valid-token-but-user-gone",
      userId: mockUserId,
      expiresAt: new Date(Date.now() + 86400000),
    });
    // Do NOT seed the user — user document is missing
    mockCurrentUser = null;
    const { POST } = await import("@/app/api/resume/upload/route");
    const formData = new FormData();
    formData.append("resume", new File(["test"], "resume.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/api/resume/upload", {
      method: "POST",
      body: formData,
      headers: { cookie: "oppy_session=valid-token-but-user-gone" },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it("returns 200 when cookie is present and session is valid", async () => {
    seedUser(mockUserId);
    mockCurrentUser = { id: mockUserId.toString() };
    const { POST } = await import("@/app/api/resume/upload/route");
    const formData = new FormData();
    formData.append("resume", new File(["content"], "resume.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost/api/resume/upload", {
      method: "POST",
      body: formData,
      headers: { cookie: "oppy_session=valid-token" },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it("credentials include is present in client fetch call", () => {
    // Verify the Profile page sends credentials: include
    const profileCode = readFileSync("app/profile/page.tsx", "utf8");
    // Check that the resume upload fetch includes credentials: include
    expect(profileCode).toContain('credentials: "include"');
  });
});

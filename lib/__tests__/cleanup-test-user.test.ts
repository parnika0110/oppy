import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const cleanupCode = readFileSync("scripts/cleanup-test-user.mjs", "utf8");

describe("cleanup-test-user — regression: cleanup must be strictly user-scoped", () => {
  it("looks up the user by email first and exits without deleting when not found", () => {
    expect(cleanupCode).toContain('users.findOne({ email: email.trim().toLowerCase() })');
    expect(cleanupCode).toContain('No user found for');
    expect(cleanupCode).toContain("nothing to delete");
  });

  it("scopes tracking deletes by the looked-up user's id (string form, as the app stores it)", () => {
    expect(cleanupCode).toContain('deleteMany({ userId: userIdString })');
    expect(cleanupCode).toContain('user._id.toString()');
  });

  it("NEVER deletes tracking by opportunityId alone", () => {
    // This is the exact regression: the failed cleanup deleted by
    // { opportunityId } without userId, which removed another user's
    // record because they had tracked the same opportunity.
    expect(cleanupCode).not.toMatch(/delete(Many|One)\(\s*\{\s*opportunityId/);
    expect(cleanupCode).not.toMatch(/opportunityId[^}]*delete(Many|One)/);
  });

  it("never deletes by any non-user field", () => {
    const deleteCalls = cleanupCode.match(/delete(Many|One)\(\{([^}]*)\}\)/g) || [];
    for (const call of deleteCalls) {
      // Every delete filter must reference userId (string or ObjectId form)
      expect(call).toMatch(/userId/);
    }
  });

  it("cleans up every user-owned collection", () => {
    for (const coll of ["applicationTracking", "savedOpportunities", "recentlyViewed", "sessions"]) {
      expect(cleanupCode).toContain(`"${coll}"`);
    }
    expect(cleanupCode).toContain("users.deleteOne");
  });
});
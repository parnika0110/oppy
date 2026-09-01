import { describe, it, expect } from "vitest";
import {
  validateSignupInput,
  hashPassword,
  verifyPassword,
  SESSION_COOKIE,
} from "@/lib/userAuth";

/**
 * Regression tests for the authentication flow.
 *
 * Root cause of the bug: login/signup pages made raw fetch() calls
 * instead of using AuthContext.login()/signup(), which meant:
 * 1. AuthProvider's user state was never updated after login
 * 2. router.push() + router.refresh() caused refresh to cancel navigation
 * 3. Onboarding page's auth guard saw user=null and redirected back to login
 *
 * The fix: login/signup pages now use AuthContext methods, which properly
 * set user state before navigation.
 */
describe("Auth flow regression", () => {
  describe("SESSION_COOKIE constant", () => {
    it("is 'oppy_session'", () => {
      expect(SESSION_COOKIE).toBe("oppy_session");
    });

    it("matches what middleware checks for", () => {
      // The middleware checks: request.cookies.get('oppy_session')
      // This test ensures the constant stays in sync
      expect(SESSION_COOKIE).toBe("oppy_session");
    });
  });

  describe("validateSignupInput", () => {
    it("accepts valid inputs", () => {
      expect(validateSignupInput("test@example.com", "password123", "John")).toBeNull();
    });

    it("rejects invalid email", () => {
      expect(validateSignupInput("not-an-email", "password123", "John")).toBe(
        "Enter a valid email address."
      );
    });

    it("rejects short password", () => {
      expect(validateSignupInput("test@example.com", "short", "John")).toBe(
        "Password must be at least 8 characters."
      );
    });

    it("rejects empty name", () => {
      expect(validateSignupInput("test@example.com", "password123", "")).toBe(
        "Enter your name."
      );
    });

    it("trims email before validation", () => {
      expect(validateSignupInput("  test@example.com  ", "password123", "John")).toBeNull();
    });
  });

  describe("password hashing", () => {
    it("hashes and verifies correctly", async () => {
      const password = "mySecurePassword123";
      const hash = await hashPassword(password);
      expect(hash).not.toBe(password);
      expect(await verifyPassword(password, hash)).toBe(true);
      expect(await verifyPassword("wrongPassword", hash)).toBe(false);
    });

    it("produces different hashes for the same password (salt)", async () => {
      const hash1 = await hashPassword("password123");
      const hash2 = await hashPassword("password123");
      // Different salt each time
      expect(hash1).not.toBe(hash2);
      // But both verify correctly
      expect(await verifyPassword("password123", hash1)).toBe(true);
      expect(await verifyPassword("password123", hash2)).toBe(true);
    });
  });

  describe("Login page uses AuthContext (structural check)", () => {
    it("login page imports useAuth", async () => {
      // Read the login page source and verify it uses AuthContext
      const fs = await import("fs");
      const path = await import("path");
      const loginPage = fs.readFileSync(
        path.join(process.cwd(), "app/login/page.tsx"),
        "utf-8"
      );
      expect(loginPage).toContain('import { useAuth } from "@/lib/AuthContext"');
      expect(loginPage).toContain("const { login } = useAuth()");
    });

    it("login page does NOT make raw fetch to /api/auth/login", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const loginPage = fs.readFileSync(
        path.join(process.cwd(), "app/login/page.tsx"),
        "utf-8"
      );
      // The login page should use AuthContext.login(), not raw fetch
      expect(loginPage).not.toMatch(/fetch\(["']\/api\/auth\/login["']/);
    });

    it("login page does NOT call router.refresh after login", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const loginPage = fs.readFileSync(
        path.join(process.cwd(), "app/login/page.tsx"),
        "utf-8"
      );
      // router.refresh() after router.push() cancels the navigation
      expect(loginPage).not.toContain("router.refresh()");
    });
  });

  describe("Signup page uses AuthContext (structural check)", () => {
    it("signup page imports useAuth", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const signupPage = fs.readFileSync(
        path.join(process.cwd(), "app/signup/page.tsx"),
        "utf-8"
      );
      expect(signupPage).toContain('import { useAuth } from "@/lib/AuthContext"');
      expect(signupPage).toContain("const { signup } = useAuth()");
    });

    it("signup page does NOT make raw fetch to /api/auth/signup", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const signupPage = fs.readFileSync(
        path.join(process.cwd(), "app/signup/page.tsx"),
        "utf-8"
      );
      expect(signupPage).not.toMatch(/fetch\(["']\/api\/auth\/signup["']/);
    });

    it("signup page does NOT call router.refresh after signup", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const signupPage = fs.readFileSync(
        path.join(process.cwd(), "app/signup/page.tsx"),
        "utf-8"
      );
      expect(signupPage).not.toContain("router.refresh()");
    });
  });

  describe("AuthContext.login() sets user state", () => {
    it("AuthContext login method sets user from API response", async () => {
      // Verify the AuthContext login method implementation
      const fs = await import("fs");
      const path = await import("path");
      const authContext = fs.readFileSync(
        path.join(process.cwd(), "lib/AuthContext.tsx"),
        "utf-8"
      );
      // The login method should call setUser(data.user) before returning
      expect(authContext).toContain("setUser(data.user)");
      // The login method should also call fetchUser to refresh saved IDs
      expect(authContext).toContain("await fetchUser()");
    });
  });

  describe("Middleware session check", () => {
    it("middleware checks for oppy_session cookie on protected routes", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const middleware = fs.readFileSync(
        path.join(process.cwd(), "middleware.ts"),
        "utf-8"
      );
      expect(middleware).toContain("request.cookies.get('oppy_session')");
      expect(middleware).toContain("/onboarding");
    });

    it("middleware does NOT check onboardingComplete", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const middleware = fs.readFileSync(
        path.join(process.cwd(), "middleware.ts"),
        "utf-8"
      );
      // The middleware should only check for the session cookie,
      // not for onboarding completion status
      expect(middleware).not.toContain("onboardingComplete");
    });
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const loginCode = readFileSync("app/login/page.tsx", "utf8");

describe("Login page — password visibility toggle", () => {
  it("has showPassword state", () => {
    expect(loginCode).toContain("showPassword");
  });

  it("toggles input type between password and text", () => {
    expect(loginCode).toContain('showPassword ? "text" : "password"');
  });

  it("has eye button with type=button to prevent form submission", () => {
    expect(loginCode).toContain('type="button"');
  });

  it("has aria-label that toggles between Show/Hide", () => {
    expect(loginCode).toContain('aria-label={showPassword ? "Hide password" : "Show password"}');
  });

  it("eye button has tabIndex=-1 to not trap keyboard focus", () => {
    expect(loginCode).toContain("tabIndex={-1}");
  });

  it("password input has extra right padding for the eye button", () => {
    expect(loginCode).toContain("paddingRight: 40");
  });

  it("input wrapper uses position relative for absolute eye button", () => {
    expect(loginCode).toContain('position: "relative"');
  });

  it("eye button is absolutely positioned inside the wrapper", () => {
    expect(loginCode).toContain('position: "absolute"');
  });

  it("does not alter login validation or submission logic", () => {
    expect(loginCode).toContain("login(email, password)");
    expect(loginCode).toContain('type="submit"');
  });

  it("does not alter email input", () => {
    expect(loginCode).toContain('type="email"');
  });
});

describe("Signup page — password visibility toggle", () => {
  const signupCode = readFileSync("app/signup/page.tsx", "utf8");

  it("has showPassword state", () => {
    expect(signupCode).toContain("showPassword");
    expect(signupCode).toContain("setShowPassword");
  });

  it("toggles input type between password and text", () => {
    expect(signupCode).toContain('showPassword ? "text" : "password"');
  });

  it("has eye button with type=button to prevent form submission", () => {
    expect(signupCode).toContain('type="button"');
  });

  it("has aria-label that toggles between Show/Hide", () => {
    expect(signupCode).toContain('aria-label={showPassword ? "Hide password" : "Show password"}');
  });

  it("eye button has tabIndex=-1 to not trap keyboard focus", () => {
    expect(signupCode).toContain("tabIndex={-1}");
  });

  it("password input has extra right padding for the eye button", () => {
    expect(signupCode).toContain("paddingRight: 40");
  });

  it("input wrapper uses position relative for absolute eye button", () => {
    expect(signupCode).toContain('position: "relative"');
    expect(signupCode).toContain('position: "absolute"');
  });

  it("uses the same eye emoji characters as login", () => {
    expect(signupCode).toContain('"🙈"');
    expect(signupCode).toContain('"👁"');
  });

  it("does not alter signup validation or submission logic", () => {
    expect(signupCode).toContain("signup(email, password, name)");
    expect(signupCode).toContain("minLength={8}");
    expect(signupCode).toContain("At least 8 characters.");
    expect(signupCode).toContain('type="submit"');
  });

  it("does not alter email input", () => {
    expect(signupCode).toContain('type="email"');
  });
});

describe("Login vs Forgot Password vs Signup — consistent toggle pattern", () => {
  const forgotCode = readFileSync("app/forgot-password/page.tsx", "utf8");
  const signupCode = readFileSync("app/signup/page.tsx", "utf8");

  it("all pages use the same eye emoji characters", () => {
    for (const code of [loginCode, forgotCode, signupCode]) {
      expect(code).toContain('"🙈"');
      expect(code).toContain('"👁"');
    }
  });

  it("all pages use the same aria-label pattern", () => {
    for (const code of [loginCode, forgotCode, signupCode]) {
      expect(code).toContain('"Hide password"');
      expect(code).toContain('"Show password"');
    }
  });

  it("all pages use type=button for the eye button", () => {
    for (const code of [loginCode, forgotCode, signupCode]) {
      const btn = code.indexOf('type="button"');
      const label = code.indexOf('aria-label={showPassword', btn);
      expect(label).toBeGreaterThan(btn);
    }
  });
});

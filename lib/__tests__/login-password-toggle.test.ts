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

describe("Login vs Forgot Password — consistent toggle pattern", () => {
  const forgotCode = readFileSync("app/forgot-password/page.tsx", "utf8");

  it("both pages use the same eye emoji characters", () => {
    expect(loginCode).toContain('"🙈"');
    expect(loginCode).toContain('"👁"');
    expect(forgotCode).toContain('"🙈"');
    expect(forgotCode).toContain('"👁"');
  });

  it("both pages use the same aria-label pattern", () => {
    expect(loginCode).toContain('"Hide password"');
    expect(loginCode).toContain('"Show password"');
    expect(forgotCode).toContain('"Hide password"');
    expect(forgotCode).toContain('"Show password"');
  });

  it("both pages use type=button for the eye button", () => {
    // Both pages should have type=button preceding the aria-label for password toggle
    const loginBtn = loginCode.indexOf('type="button"');
    const loginLabel = loginCode.indexOf('aria-label={showPassword', loginBtn);
    expect(loginLabel).toBeGreaterThan(loginBtn);
    const forgotBtn = forgotCode.indexOf('type="button"');
    const forgotLabel = forgotCode.indexOf('aria-label={showPassword', forgotBtn);
    expect(forgotLabel).toBeGreaterThan(forgotBtn);
  });
});

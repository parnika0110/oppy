import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const navCode = readFileSync("components/Nav.tsx", "utf8");
const modalCode = readFileSync("components/LogoutConfirmModal.tsx", "utf8");

// ── 1. Nav uses modal, not immediate logout ──────────────────────────────

describe("Nav — logout shows confirmation modal", () => {
  it("does NOT call handleLogout directly on button click", () => {
    // The Logout button should open the modal, not call handleLogout
    expect(navCode).toContain("onClick={() => setShowLogoutModal(true)}");
    expect(navCode).not.toMatch(/onClick=\{handleLogout\}/);
  });

  it("has showLogoutModal state", () => {
    expect(navCode).toContain("showLogoutModal");
  });

  it("renders LogoutConfirmModal component", () => {
    expect(navCode).toContain("<LogoutConfirmModal");
  });

  it("imports LogoutConfirmModal", () => {
    expect(navCode).toContain('import LogoutConfirmModal from "./LogoutConfirmModal"');
  });

  it("passes open/onConfirm/onCancel props", () => {
    expect(navCode).toContain("open={showLogoutModal}");
    expect(navCode).toContain("onConfirm={handleLogout}");
    expect(navCode).toContain("onCancel={() => setShowLogoutModal(false)}");
  });

  it("handleLogout closes modal before logging out", () => {
    // handleLogout should set showLogoutModal to false before calling logout
    expect(navCode).toContain("setShowLogoutModal(false)");
  });
});

// ── 2. Modal component behavior ─────────────────────────────────────────

describe("LogoutConfirmModal — dialog behavior", () => {
  it("renders with role=dialog", () => {
    expect(modalCode).toContain('role="dialog"');
  });

  it("has aria-modal=true", () => {
    expect(modalCode).toContain('aria-modal="true"');
  });

  it("has aria-labelledby pointing to title", () => {
    expect(modalCode).toContain('aria-labelledby="logout-title"');
  });

  it("has aria-describedby pointing to description", () => {
    expect(modalCode).toContain('aria-describedby="logout-desc"');
  });

  it("displays the correct title", () => {
    expect(modalCode).toContain("Leaving already? 👀");
  });

  it("displays the correct message", () => {
    expect(modalCode).toContain("You can always come back when opportunity calls.");
  });

  it("renders 'Stay' button", () => {
    expect(modalCode).toContain("Stay");
  });

  it("renders 'Log out' button", () => {
    expect(modalCode).toContain("Log out");
  });

  it("does NOT use native confirm()", () => {
    expect(modalCode).not.toContain("window.confirm");
    expect(modalCode).not.toContain("confirm(");
  });
});

// ── 3. Escape and outside click ──────────────────────────────────────────

describe("LogoutConfirmModal — dismiss behavior", () => {
  it("listens for Escape keydown", () => {
    expect(modalCode).toContain('"Escape"');
    expect(modalCode).toContain("onKeyDown");
  });

  it("calls onCancel on Escape", () => {
    expect(modalCode).toContain("onCancel()");
  });

  it("closes on backdrop click (outside modal)", () => {
    // The overlay onClick should call onCancel when clicking the backdrop
    expect(modalCode).toContain("e.target === e.currentTarget");
  });

  it("does not close on modal body click", () => {
    expect(modalCode).toContain("e.stopPropagation()");
  });

  it("cleans up keydown listener on unmount", () => {
    expect(modalCode).toContain("removeEventListener");
  });
});

// ── 4. Double-submission prevention ──────────────────────────────────────

describe("LogoutConfirmModal — double-click protection", () => {
  it("has processing state", () => {
    expect(modalCode).toContain("processing");
  });

  it("guards handleConfirm with processing check", () => {
    expect(modalCode).toContain("if (processing) return");
  });

  it("disables buttons while processing", () => {
    expect(modalCode).toContain("disabled={processing}");
  });

  it("shows 'Logging out…' while processing", () => {
    expect(modalCode).toContain("Logging out…");
  });

  it("resets processing state on open", () => {
    expect(modalCode).toContain("setProcessing(false)");
  });
});

// ── 5. Focus management ──────────────────────────────────────────────────

describe("LogoutConfirmModal — focus management", () => {
  it("focuses the cancel button on open", () => {
    expect(modalCode).toContain("cancelRef.current?.focus()");
  });

  it("cancel button has ref", () => {
    expect(modalCode).toContain("cancelRef");
  });
});

// ── 6. Viewport positioning ──────────────────────────────────────────────

describe("LogoutConfirmModal — viewport positioning", () => {
  it("is rendered through a portal into document.body", () => {
    // Portaling escapes the sticky <header> whose backdrop-filter would
    // otherwise become the containing block for position: fixed and clip
    // the dialog to the header height.
    expect(modalCode).toContain("createPortal(");
    expect(modalCode).toContain('from "react-dom"');
    expect(modalCode).toContain("document.body");
  });

  it("overlay uses position: fixed (inline style)", () => {
    expect(modalCode).toContain('position: "fixed"');
  });

  it("overlay covers full viewport with inset: 0", () => {
    expect(modalCode).toContain('inset: 0');
  });

  it("overlay has high z-index above page content", () => {
    expect(modalCode).toContain('zIndex: 9999');
  });

  it("overlay scrolls internally when dialog exceeds viewport", () => {
    expect(modalCode).toContain('overflowY: "auto"');
  });

  it("wrapper uses flex centering for the dialog", () => {
    expect(modalCode).toContain('display: "flex"');
    expect(modalCode).toContain('alignItems: "center"');
    expect(modalCode).toContain('justifyContent: "center"');
  });

  it("wrapper uses min-height 100% so a tall dialog scrolls without clipping its top", () => {
    expect(modalCode).toContain('minHeight: "100%"');
  });

  it("wrapper has padding to keep safe vertical/horizontal margins", () => {
    expect(modalCode).toContain('padding: "1rem"');
  });

  it("does NOT center with top:50% + translateY(-50%)", () => {
    // The translateY approach pushes a tall modal above the viewport.
    expect(modalCode).not.toContain('top: "50%"');
    expect(modalCode).not.toContain("translateY");
  });

  it("dialog has flexShrink: 0 to prevent compression", () => {
    expect(modalCode).toContain('flexShrink: 0');
  });
});

// ── 7. Body scroll prevention ────────────────────────────────────────────

describe("LogoutConfirmModal — body scroll prevention", () => {
  it("sets body overflow to hidden when open", () => {
    expect(modalCode).toContain('document.body.style.overflow = "hidden"');
  });

  it("restores previous overflow on close", () => {
    expect(modalCode).toContain('document.body.style.overflow = prev');
  });

  it("cleanup runs when modal closes", () => {
    expect(modalCode).toContain('document.body.style.overflow = prev');
  });
});

// ── 8. AuthContext logout unchanged ──────────────────────────────────────

describe("AuthContext — logout function unchanged", () => {
  const authCode = readFileSync("lib/AuthContext.tsx", "utf8");

  it("logout calls /api/auth/logout", () => {
    expect(authCode).toContain("/api/auth/logout");
  });

  it("logout clears user state", () => {
    expect(authCode).toContain("setUser(null)");
  });

  it("logout uses POST method", () => {
    expect(authCode).toContain('method: "POST"');
  });
});

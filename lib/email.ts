/**
 * Email utility for OPPY.
 *
 * Uses Resend (https://resend.com) for transactional email delivery.
 * Requires RESEND_API_KEY environment variable and a verified domain
 * in the Resend dashboard.
 *
 * All emails are server-side only. Never expose the API key to the browser.
 */

import { Resend } from "resend";

let _resend: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!_resend) {
    _resend = new Resend(apiKey);
  }
  return _resend;
}

function getFromAddress(): string {
  // Use RESEND_FROM_EMAIL if set, otherwise default to oppy
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (fromEmail) return fromEmail;

  const fromDomain = process.env.RESEND_FROM_DOMAIN || "oppy.dev";
  return `OPPY <noreply@${fromDomain}>`;
}

/**
 * Send a password reset email with a 6-digit code.
 * Returns true if the email was sent successfully, false otherwise.
 */
export async function sendPasswordResetEmail(
  email: string,
  code: string
): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.warn(
      "[Email] RESEND_API_KEY not configured. Password reset code not sent."
    );
    return false;
  }

  try {
    await resend.emails.send({
      from: getFromAddress(),
      to: email,
      subject: "Your OPPY Password Reset Code",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #FAF6EF;">
  <div style="max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #E5E7EB;">
    <!-- Header -->
    <div style="padding: 32px 32px 0; text-align: center;">
      <h1 style="margin: 0; font-size: 1.5rem; color: #1a1a2e; letter-spacing: -0.02em;">OPPY</h1>
    </div>

    <!-- Content -->
    <div style="padding: 24px 32px 32px;">
      <h2 style="margin: 0 0 12px; font-size: 1.15rem; color: #1a1a2e;">Reset your password</h2>
      <p style="margin: 0 0 24px; font-size: 0.9rem; color: #6B7280; line-height: 1.5;">
        Use the code below to reset your password. This code expires in 15 minutes.
      </p>

      <!-- Code -->
      <div style="text-align: center; margin: 0 0 24px;">
        <div style="
          display: inline-block;
          padding: 16px 32px;
          background: #F3F0FF;
          border: 2px dashed #8B7DC7;
          border-radius: 12px;
          font-family: 'JetBrains Mono', 'Courier New', monospace;
          font-size: 1.75rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: #4A3F8A;
        ">
          ${code}
        </div>
      </div>

      <p style="margin: 0 0 8px; font-size: 0.8rem; color: #9CA3AF; text-align: center;">
        If you didn't request a password reset, you can safely ignore this email.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding: 16px 32px; border-top: 1px solid #F3F4F6; text-align: center;">
      <p style="margin: 0; font-size: 0.75rem; color: #9CA3AF;">
        OPPY — Real opportunity discovery
      </p>
    </div>
  </div>
</body>
</html>
      `.trim(),
    });

    console.log(`[Email] Password reset code sent to ${email}`);
    return true;
  } catch (err) {
    console.error(`[Email] Failed to send password reset to ${email}:`, err);
    return false;
  }
}

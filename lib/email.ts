/**
 * Email utility for OPPY.
 *
 * Uses EmailJS (https://emailjs.com) REST API for transactional email delivery.
 * Requires EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, and
 * EMAILJS_PRIVATE_KEY environment variables.
 *
 * All emails are server-side only. Never expose credentials to the browser.
 */

const EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";

/**
 * Send a password reset email with a 6-digit code.
 * Returns true if the email was sent successfully, false otherwise.
 */
export async function sendPasswordResetEmail(
  email: string,
  code: string
): Promise<boolean> {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.warn(
      "[Email] EmailJS not configured (missing required env vars). Password reset code not sent."
    );
    return false;
  }

  try {
    const response = await fetch(EMAILJS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: {
          to_email: email,
          code: code,
          expiry_minutes: "15",
          app_name: "OPPY",
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      console.error(
        `[Email] EmailJS returned ${response.status}: ${body}`
      );
      return false;
    }

    console.log(`[Email] Password reset code sent to ${email}`);
    return true;
  } catch (err) {
    console.error(`[Email] Failed to send password reset to ${email}:`, err);
    return false;
  }
}

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

  // Diagnostic: log env var availability (booleans only, never values)
  console.log("[Email] EmailJS env availability:", {
    serviceId: Boolean(serviceId),
    templateId: Boolean(templateId),
    publicKey: Boolean(publicKey),
    privateKey: Boolean(privateKey),
  });

  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.warn(
      "[Email] EmailJS not configured (missing required env vars). Password reset code not sent."
    );
    return false;
  }

  try {
    console.log("[Email] Attempting EmailJS request");
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

    console.log("[Email] EmailJS response:", response.status);

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

// ── Deadline Reminder Emails ──────────────────────────────────────────────

const REMINDER_TEMPLATE_ID = process.env.EMAILJS_REMINDER_TEMPLATE_ID || process.env.EMAILJS_TEMPLATE_ID;

export interface DeadlineReminderParams {
  userName: string;
  opportunityTitle: string;
  organization: string;
  category: string;
  deadlineDate: Date;
  daysRemaining: number;
  reminderType: "closing_3day" | "closing_1day";
}

/**
 * Send a deadline reminder email for a saved opportunity approaching its deadline.
 * Returns true if the email was sent successfully.
 */
export async function sendDeadlineReminder(
  email: string,
  params: DeadlineReminderParams
): Promise<boolean> {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = REMINDER_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.warn("[Email] EmailJS not configured — deadline reminder skipped.");
    return false;
  }

  const deadlineStr = params.deadlineDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const urgencyLabel =
    params.reminderType === "closing_1day"
      ? "Closing tomorrow!"
      : `Closing in ${params.daysRemaining} days`;

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
          user_name: params.userName,
          opportunity_title: params.opportunityTitle,
          organization: params.organization,
          category: params.category,
          deadline_date: deadlineStr,
          days_remaining: String(params.daysRemaining),
          urgency_label: urgencyLabel,
          app_name: "OPPY",
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      console.error(`[Email] Deadline reminder failed (${response.status}): ${body}`);
      return false;
    }

    console.log(`[Email] Deadline reminder sent to ${email} for "${params.opportunityTitle}"`);
    return true;
  } catch (err) {
    console.error(`[Email] Deadline reminder error for ${email}:`, err);
    return false;
  }
}

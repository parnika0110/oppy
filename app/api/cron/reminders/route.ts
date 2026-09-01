import { NextResponse } from "next/server";
import { processDeadlineReminders } from "@/lib/reminders";
import { isCronRequest } from "@/lib/auth";

export const maxDuration = 120; // 120 seconds — email sending can be slow

/**
 * GET /api/cron/reminders
 *
 * Sends deadline reminder emails for saved opportunities approaching their deadline.
 * Runs automatically via AWS EventBridge (every 12 hours recommended).
 *
 * Authentication:
 *   - Bearer CRON_SECRET (for EventBridge / automated triggers)
 *   - Admin session cookie (for manual admin triggers)
 *
 * Idempotency:
 *   Safe to run multiple times per day. Deduplication is handled by
 *   the reminderLog collection using (userId, opportunityId, reminderType, dateBucket).
 */
export async function GET(request: Request) {
  try {
    if (!(await isCronRequest(request))) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    console.log("[CRON] Deadline reminders triggered.");

    const result = await processDeadlineReminders();

    console.log(
      `[CRON] Reminders complete. Sent: ${result.sent}, ` +
      `Skipped: ${result.skipped}, Errors: ${result.errors}`
    );

    return NextResponse.json({
      success: true,
      message: "Deadline reminders processed.",
      data: {
        sent: result.sent,
        skipped: result.skipped,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error("[CRON] Reminders failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

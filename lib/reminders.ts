/**
 * Deadline Reminder System
 *
 * Sends email reminders for saved opportunities approaching their deadline.
 * Runs via /api/cron/reminders (triggered by AWS EventBridge).
 *
 * Anti-duplicate strategy:
 * - Each reminder is keyed by (userId, opportunityId, reminderType, dateBucket)
 * - dateBucket groups reminders by day so the same user gets at most one
 *   reminder per opportunity per day for each reminder type.
 */

import {
  getSavedOpportunitiesCollection,
  getOpportunitiesCollection,
  getUsersCollection,
  getReminderLogCollection,
  ensureUserIndexes,
} from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { sendDeadlineReminder } from "@/lib/email";

export type ReminderType = "closing_3day" | "closing_1day";

interface ReminderCandidate {
  userId: string;
  userEmail: string;
  userName: string;
  opportunityId: string;
  title: string;
  organization: string;
  category: string;
  deadlineDate: Date;
  daysRemaining: number;
  reminderType: ReminderType;
}

/**
 * Find saved opportunities with approaching deadlines and send reminders.
 * Returns the number of reminders sent.
 */
export async function processDeadlineReminders(): Promise<{
  sent: number;
  skipped: number;
  errors: number;
}> {
  await ensureUserIndexes();

  const now = new Date();
  const saved = await getSavedOpportunitiesCollection();
  const opps = await getOpportunitiesCollection();
  const users = await getUsersCollection();
  const reminderLog = await getReminderLogCollection();

  // Date buckets for dedup (YYYY-MM-DD)
  const todayBucket = now.toISOString().slice(0, 10);

  // Find all active saved opportunities
  const savedDocs = await saved.find({}).toArray();

  if (savedDocs.length === 0) {
    return { sent: 0, skipped: 0, errors: 0 };
  }

  // Get unique opportunity IDs
  const oppIds = [
    ...new Set(savedDocs.map((s: any) => s.opportunityId).filter(Boolean)),
  ];
  const oppObjectIds = oppIds
    .map((id: string) => {
      try { return new ObjectId(id); } catch { return null; }
    })
    .filter((x): x is ObjectId => x !== null);

  if (oppObjectIds.length === 0) {
    return { sent: 0, skipped: 0, errors: 0 };
  }

  // Fetch active opportunities
  const oppDocs = await opps
    .find({
      _id: { $in: oppObjectIds },
      lifecycleStatus: "active",
    })
    .toArray();

  const oppMap = new Map(oppDocs.map((o: any) => [o._id.toString(), o]));

  // Get unique user IDs
  const userIds = [...new Set(savedDocs.map((s: any) => s.userId).filter(Boolean))];
  const userDocs = await users
    .find({ _id: { $in: userIds.map((id: string) => { try { return new ObjectId(id); } catch { return null; } }).filter(Boolean) as ObjectId[] } })
    .toArray();

  const userMap = new Map(userDocs.map((u: any) => [u._id.toString(), u]));

  // Build candidates
  const candidates: ReminderCandidate[] = [];

  for (const save of savedDocs) {
    const opp = oppMap.get(save.opportunityId);
    if (!opp) continue;

    const user = userMap.get(save.userId);
    if (!user?.email) continue;

    // Find nearest deadline
    const deadlines: Array<{ date: Date | null; type: ReminderType; daysField: string }> = [
      {
        date: opp.applicationDeadline instanceof Date ? opp.applicationDeadline : null,
        type: "closing_3day",
        daysField: "application",
      },
      {
        date: opp.deadline instanceof Date ? opp.deadline : null,
        type: "closing_3day",
        daysField: "deadline",
      },
      {
        date: opp.registrationDeadline instanceof Date ? opp.registrationDeadline : null,
        type: "closing_3day",
        daysField: "registration",
      },
    ];

    for (const dl of deadlines) {
      if (!dl.date || dl.date < now) continue;

      const daysRemaining = Math.ceil(
        (dl.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Determine reminder type based on urgency
      let reminderType: ReminderType;
      if (daysRemaining <= 1) {
        reminderType = "closing_1day";
      } else if (daysRemaining <= 3) {
        reminderType = "closing_3day";
      } else {
        continue; // Not within reminder window
      }

      candidates.push({
        userId: save.userId,
        userEmail: user.email,
        userName: user.name,
        opportunityId: save.opportunityId,
        title: opp.title,
        organization: opp.organization,
        category: opp.category,
        deadlineDate: dl.date,
        daysRemaining,
        reminderType,
      });
    }
  }

  if (candidates.length === 0) {
    return { sent: 0, skipped: 0, errors: 0 };
  }

  // Deduplicate: check which reminders already sent today
  const existingReminders = await reminderLog
    .find({
      dateBucket: todayBucket,
    })
    .toArray();

  const sentKeySet = new Set(
    existingReminders.map(
      (r: any) => `${r.userId}:${r.opportunityId}:${r.reminderType}`
    )
  );

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  // Send reminders
  for (const candidate of candidates) {
    const dedupKey = `${candidate.userId}:${candidate.opportunityId}:${candidate.reminderType}`;

    if (sentKeySet.has(dedupKey)) {
      skipped++;
      continue;
    }

    try {
      const success = await sendDeadlineReminder(candidate.userEmail, {
        userName: candidate.userName,
        opportunityTitle: candidate.title,
        organization: candidate.organization,
        category: candidate.category,
        deadlineDate: candidate.deadlineDate,
        daysRemaining: candidate.daysRemaining,
        reminderType: candidate.reminderType,
      });

      if (success) {
        // Log the reminder
        await reminderLog.insertOne({
          userId: candidate.userId,
          opportunityId: candidate.opportunityId,
          reminderType: candidate.reminderType,
          dateBucket: todayBucket,
          sentAt: now,
        });
        sent++;
        sentKeySet.add(dedupKey);
      } else {
        errors++;
      }
    } catch (err) {
      console.error("[Reminders] Error sending reminder:", err);
      errors++;
    }
  }

  return { sent, skipped, errors };
}

import { getOpportunitiesCollection } from "@/lib/mongodb";

function passed(value: unknown, now: Date): boolean {
  return value instanceof Date && value < now;
}

/** Safely transitions only active records with verified, passed actionable dates. Archived records are never touched. */
export async function refreshOpportunityLifecycle() {
  const collection = await getOpportunitiesCollection();
  const now = new Date();
  const cursor = collection.find({ lifecycleStatus: { $ne: "archived" }, $or: [{ lifecycleStatus: "active" }, { lifecycleStatus: { $exists: false }, isActive: true }] });
  let closed = 0;
  for await (const opportunity of cursor) {
    const deadlinePassed = ["verified", "source_provided"].includes(String(opportunity.deadlineKind)) && passed(opportunity.deadline, now);
    const applicationPassed = passed(opportunity.applicationDeadline, now);
    const registrationPassed = passed(opportunity.registrationDeadline, now);
    const noActionDate = !opportunity.deadline && !opportunity.applicationDeadline && !opportunity.registrationDeadline;
    const eventEnded = noActionDate && (passed(opportunity.eventEndDate, now) || (!opportunity.eventEndDate && passed(opportunity.eventDate, now)));
    if (deadlinePassed || applicationPassed || registrationPassed || eventEnded) {
      await collection.updateOne({ _id: opportunity._id, lifecycleStatus: { $ne: "archived" } }, { $set: { lifecycleStatus: "closed", isActive: false, lifecycleUpdatedAt: now, updatedAt: now } });
      closed++;
    }
  }
  return { closed, checkedAt: now };
}

import { DeadlineKind, UrgencyTier } from "@/types/opportunity";

export interface UrgencyInfo {
  tier: UrgencyTier;
  daysLeft: number;
  label: string;
}

/**
 * Computes urgency tier + human label from a raw deadline.
 * Called both server-side (default sort/filter) and client-side (badge render),
 * so it must be pure and deterministic given `now`.
 */
export function getUrgency(deadline: Date | string | null | undefined, deadlineKind?: DeadlineKind | null, now: Date = new Date()): UrgencyInfo {
  if (deadlineKind === "rolling") return { tier: "normal", daysLeft: 0, label: "Rolling deadline" };
  if (!deadline || !deadlineKind || deadlineKind === "unavailable") {
    return { tier: "normal", daysLeft: 0, label: "Deadline unavailable" };
  }
  const deadlineDate = typeof deadline === "string" ? new Date(deadline) : deadline;
  if (isNaN(deadlineDate.getTime())) {
    return { tier: "normal", daysLeft: 0, label: "Deadline unavailable" };
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  // Compare at day granularity so "closes today" is accurate regardless of time-of-day.
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDeadlineDay = new Date(
    deadlineDate.getFullYear(),
    deadlineDate.getMonth(),
    deadlineDate.getDate()
  );

  const daysLeft = Math.round(
    (startOfDeadlineDay.getTime() - startOfToday.getTime()) / msPerDay
  );

  if (daysLeft < 0) {
    return { tier: "expired", daysLeft, label: "Closed" };
  }
  if (daysLeft === 0) {
    return { tier: "critical", daysLeft, label: "Closes today" };
  }
  if (daysLeft === 1) {
    return { tier: "critical", daysLeft, label: "Closes tomorrow" };
  }
  if (daysLeft <= 7) {
    return { tier: "warning", daysLeft, label: `Closes in ${daysLeft} days` };
  }
  return { tier: "normal", daysLeft, label: `Closes in ${daysLeft} days` };
}

export function isExpired(deadline: Date | string | null | undefined, deadlineKind?: DeadlineKind | null, now: Date = new Date()): boolean {
  return getUrgency(deadline, deadlineKind, now).tier === "expired";
}

export const URGENCY_COLORS: Record<UrgencyTier, { bg: string; text: string; dot: string }> = {
  normal: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  warning: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  critical: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  expired: { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" },
};

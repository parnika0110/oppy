"use client";

import { getUrgency, URGENCY_COLORS } from "@/lib/urgency";
import { DeadlineKind } from "@/types/opportunity";

export default function UrgencyBadge({ deadline, deadlineKind }: { deadline: string | Date | null; deadlineKind?: DeadlineKind | null }) {
  const urgency = getUrgency(deadline, deadlineKind);
  const colors = URGENCY_COLORS[urgency.tier];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {urgency.label}
    </span>
  );
}

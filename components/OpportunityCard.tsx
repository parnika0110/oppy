import Link from "next/link";
import { OpportunityDocument } from "@/types/opportunity";
import UrgencyBadge from "./UrgencyBadge";
import SaveButton from "./SaveButton";

export default function OpportunityCard({ opportunity }: { opportunity: OpportunityDocument }) {
  const formattedDeadline = opportunity.deadline && (opportunity.deadlineKind === "verified" || opportunity.deadlineKind === "source_provided")
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(opportunity.deadline))
    : null;

  return (
    <div className="relative bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-gray-300 transition-all">
      <Link href={`/opportunity/${opportunity._id}`} className="group block pr-10">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center font-semibold" aria-hidden="true">{opportunity.organization.charAt(0)}</div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{opportunity.organization}</p>
            <h3 className="mt-0.5 font-semibold text-gray-900 leading-snug line-clamp-2">{opportunity.title}</h3>
          </div>
        </div>
        <div className="mt-3">
          <UrgencyBadge deadline={opportunity.deadline} deadlineKind={opportunity.deadlineKind} />
          {formattedDeadline && <p className="mt-1 text-xs text-gray-500">Deadline: {formattedDeadline}</p>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">{opportunity.category}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">{opportunity.location}</span>
        </div>
        {opportunity.aiSummary?.summary && <p className="mt-2 text-sm text-gray-600 line-clamp-2">{opportunity.aiSummary.summary}</p>}
        {opportunity.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {opportunity.tags.slice(0, 3).map((tag) => <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{tag}</span>)}
          </div>
        )}
      </Link>
      <div className="absolute right-4 top-4"><SaveButton id={opportunity._id} /></div>
    </div>
  );
}

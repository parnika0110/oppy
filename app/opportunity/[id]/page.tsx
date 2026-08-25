import { notFound } from "next/navigation";
import UrgencyBadge from "@/components/UrgencyBadge";
import SaveButton from "@/components/SaveButton";
import { OpportunityDocument } from "@/types/opportunity";

async function getOpportunity(id: string): Promise<OpportunityDocument | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/opportunities/${id}`, {
    next: { revalidate: 60 },
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load opportunity");

  const data = await res.json();
  return data.item;
}

export default async function OpportunityDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const opportunity = await getOpportunity(id);

  if (!opportunity) notFound();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 shrink-0 rounded-xl bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-500" aria-hidden="true">
            {opportunity.organization.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{opportunity.organization}</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">{opportunity.title}</h1>
          </div>
        </div>
        <SaveButton id={opportunity._id} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <UrgencyBadge deadline={opportunity.deadline} deadlineKind={opportunity.deadlineKind} />
        {opportunity.deadline && (opportunity.deadlineKind === "verified" || opportunity.deadlineKind === "source_provided") && <span className="text-sm text-gray-600">Deadline: {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(opportunity.deadline))}</span>}
        <span className="text-sm px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">
          {opportunity.category}
        </span>
        <span className="text-sm px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
          {opportunity.location}
        </span>
        {opportunity.tags.map((tag) => (
          <span key={tag} className="text-sm px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
            {tag}
          </span>
        ))}
      </div>

      {opportunity.aiSummary && (
        <div className="mt-6 bg-blue-50/50 border border-blue-100 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 uppercase tracking-wide">
            ✦ AI Summary
          </div>
          <p className="text-gray-800">{opportunity.aiSummary.summary}</p>

          {opportunity.aiSummary.eligibility.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Eligibility</h3>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
                {opportunity.aiSummary.eligibility.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {opportunity.aiSummary.keyDates.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Key Dates</h3>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
                {opportunity.aiSummary.keyDates.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {opportunity.aiSummary.takeaways.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Key Takeaways</h3>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
                {opportunity.aiSummary.takeaways.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Full Description</h2>
        <p className="text-gray-700 whitespace-pre-line leading-relaxed">
          {opportunity.description}
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-900">Official source</h2>
        <p className="mt-1 text-sm text-gray-600">Check the official listing for the latest eligibility, requirements, and deadline.</p>
        <a href={opportunity.sourceUrl || opportunity.applicationLink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-medium text-blue-700 hover:underline">Open official source</a>
      </div>

      <a
        href={opportunity.applicationLink}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 block w-full text-center bg-gray-900 text-white font-semibold py-3 rounded-xl hover:bg-gray-800 transition-colors"
      >
        Apply Now →
      </a>
    </div>
  );
}

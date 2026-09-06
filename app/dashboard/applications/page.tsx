import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/userAuth";
import TrackingDashboard from "@/components/TrackingDashboard";

export const metadata = {
  title: "Applications · OPPY",
};

/**
 * Centralized application tracker.
 *
 * Server-guarded: only authenticated users can view their tracked
 * opportunities. Unauthenticated visitors are sent to login with the return
 * path preserved. All data comes from the server-backed /api/tracking route
 * (joined with opportunity data) — nothing is stored in localStorage.
 */
export default async function ApplicationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/applications");

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow mb-2">Your tracker</p>
        <h1
          className="font-display font-semibold tracking-tight"
          style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)", color: "var(--ink)" }}
        >
          Applications
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
          Every opportunity you&apos;ve tracked, in one place — update your
          status without opening each listing.
        </p>
      </div>

      <TrackingDashboard standalone />
    </div>
  );
}
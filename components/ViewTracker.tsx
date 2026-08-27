"use client";

import { useEffect } from "react";

/**
 * Fire-and-forget view tracker. Mount it on the opportunity detail page
 * to record that the current user viewed this opportunity.
 *
 * Only fires if the user is logged in (server checks auth).
 * Silently fails — never blocks or shows errors to the user.
 */
export default function ViewTracker({ opportunityId }: { opportunityId: string }) {
  useEffect(() => {
    // Small delay so we don't fire on rapid navigation
    const timer = setTimeout(() => {
      fetch("/api/recently-viewed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId }),
      }).catch(() => {
        // Silently ignore — view tracking is best-effort
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [opportunityId]);

  return null;
}

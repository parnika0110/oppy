"use client";

import { useState, useEffect } from "react";
import ApplicationTracker from "./ApplicationTracker";
import { useAuth } from "@/lib/AuthContext";

/**
 * DetailTracker — fetches tracking status for a single opportunity
 * and renders ApplicationTracker on the opportunity detail page.
 *
 * This is the bridge between the server-rendered detail page and the
 * client-side tracking UI.
 */
export default function DetailTracker({ opportunityId }: { opportunityId: string }) {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (authLoading || !user) {
      setLoaded(true);
      return;
    }

    async function fetchStatus() {
      try {
        const res = await fetch(`/api/tracking?opportunityId=${opportunityId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.items && data.items.length > 0) {
            setStatus(data.items[0].status);
          }
        }
      } catch {
        // Silently handle — tracker will show default state
      } finally {
        setLoaded(true);
      }
    }

    fetchStatus();
  }, [opportunityId, user, authLoading]);

  // Don't render anything until auth and tracking state are resolved
  if (!loaded) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="w-16 h-6 rounded-full skeleton" />
        ))}
      </div>
    );
  }

  // If user is not logged in, don't show the tracker
  if (!user) return null;

  return (
    <ApplicationTracker
      opportunityId={opportunityId}
      currentStatus={status}
    />
  );
}

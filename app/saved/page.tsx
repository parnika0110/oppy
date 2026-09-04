"use client";

import { useEffect, useState, useCallback } from "react";
import OpportunityCard from "@/components/OpportunityCard";
import ApplicationTracker from "@/components/ApplicationTracker";
import OppyEmptyState from "@/components/OppyEmptyState";
import { useAuth } from "@/lib/AuthContext";
import { OpportunityDocument } from "@/types/opportunity";

interface TrackingEntry {
  opportunityId: string;
  status: string;
}

export default function SavedPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<OpportunityDocument[]>([]);
  const [tracking, setTracking] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const loadSaved = useCallback(async () => {
    setLoading(true);
    try {
      const [savedRes, trackingRes] = await Promise.all([
        fetch("/api/saved"),
        fetch("/api/tracking"),
      ]);
      if (savedRes.ok) {
        const data = await savedRes.json();
        setItems(data.items || []);
      } else {
        setItems([]);
      }
      if (trackingRes.ok) {
        const tData = await trackingRes.json();
        const tMap = new Map<string, string>();
        for (const entry of tData.items || []) {
          tMap.set(entry.opportunityId, entry.status);
        }
        setTracking(tMap);
      }
      // If tracking request fails, silently continue with empty tracking map
      // (non-critical: tracking status shows as default "saved" on cards)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) loadSaved();
    else if (!authLoading) setLoading(false);
  }, [authLoading, user, loadSaved]);

  if (!authLoading && !user) {
    return (
      <div className="py-20 text-center rounded-2xl" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
        <p className="font-display font-semibold text-lg" style={{ color: "var(--ink)" }}>
          Log in to see your saved opportunities
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
          Saved opportunities are tied to your account so they follow you across devices.
        </p>
        <a
          href="/login?next=/saved"
          className="mt-5 inline-block text-sm font-medium px-4 py-2 rounded-full"
          style={{ background: "var(--ink)", color: "var(--paper)", fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Log in →
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow mb-2">Your collection</p>
        <h1 className="font-display font-semibold tracking-tight" style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)", color: "var(--ink)" }}>
          Saved Opportunities
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
          Synced to your account — available on any device.
        </p>
      </div>

      {loading || authLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--line)", background: "var(--card)" }}>
              <div className="h-36 skeleton" />
              <div className="p-5 space-y-3">
                <div className="h-3 skeleton rounded w-2/3" />
                <div className="h-4 skeleton rounded" />
                <div className="h-3 skeleton rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <OppyEmptyState
          mood="curious"
          title="Nothing saved yet"
          description="Browse opportunities and tap the bookmark icon to save them here."
          action={{ label: "Browse opportunities →", href: "/" }}
        />
      ) : (
        <>
          <p className="eyebrow mb-5">
            {items.length} saved {items.length === 1 ? "opportunity" : "opportunities"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((opp) => (
              <div key={opp._id} className="relative flex flex-col">
                <OpportunityCard opportunity={opp} />
                <div className="mt-1.5 px-5 pb-2">
                  <ApplicationTracker
                    opportunityId={opp._id}
                    currentStatus={tracking.get(opp._id)}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

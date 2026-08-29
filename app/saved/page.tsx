"use client";

import { useEffect, useState, useCallback } from "react";
import OpportunityCard from "@/components/OpportunityCard";
import ApplicationTracker from "@/components/ApplicationTracker";
import { useAuth } from "@/lib/AuthContext";
import { OpportunityDocument } from "@/types/opportunity";

export default function SavedPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<OpportunityDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSaved = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saved");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      } else {
        setItems([]);
      }
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
        <div className="py-20 text-center rounded-2xl" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
          <p className="font-display font-semibold text-lg" style={{ color: "var(--ink)" }}>
            Nothing saved yet
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
            Browse opportunities and tap the bookmark icon to save them here.
          </p>
          <a
            href="/"
            className="mt-5 inline-block text-sm font-medium px-4 py-2 rounded-full"
            style={{ background: "var(--ink)", color: "var(--paper)", fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Browse opportunities →
          </a>
        </div>
      ) : (
        <>
          <p className="eyebrow mb-5">
            {items.length} saved {items.length === 1 ? "opportunity" : "opportunities"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((opp) => (
              <div key={opp._id} className="relative">
                <OpportunityCard opportunity={opp} />
                <div className="mt-2 px-2">
                  <ApplicationTracker opportunityId={opp._id} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

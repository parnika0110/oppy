"use client";

import { useState, useEffect } from "react";
import OpportunityCard from "./OpportunityCard";
import { OpportunityDocument } from "@/types/opportunity";

/**
 * SimilarOpportunities — Shows related opportunities on the detail page.
 * Fetches from /api/opportunities/similar based on the current opportunity ID.
 */
export default function SimilarOpportunities({ opportunityId }: { opportunityId: string }) {
  const [items, setItems] = useState<OpportunityDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSimilar() {
      try {
        const res = await fetch(`/api/opportunities/similar?id=${opportunityId}&limit=4`);
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchSimilar();
  }, [opportunityId]);

  if (loading) {
    return (
      <section className="mt-12">
        <p className="eyebrow mb-2">Related</p>
        <h2
          className="font-display font-semibold tracking-tight mb-5"
          style={{ fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)", color: "var(--ink)" }}
        >
          Similar opportunities
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
          {[1, 2, 3, 4].map((i) => (
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
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="mt-12">
      <p className="eyebrow mb-2">Related</p>
      <h2
        className="font-display font-semibold tracking-tight mb-5"
        style={{ fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)", color: "var(--ink)" }}
      >
        Similar opportunities
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
        {items.map((opp) => (
          <OpportunityCard key={opp._id} opportunity={opp} variant="similar" />
        ))}
      </div>
    </section>
  );
}

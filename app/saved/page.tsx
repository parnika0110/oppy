"use client";

import { useEffect, useState, useCallback } from "react";
import OpportunityCard from "@/components/OpportunityCard";
import { getSavedIds } from "@/lib/savedStorage";
import { OpportunityDocument } from "@/types/opportunity";

export default function SavedPage() {
  const [items, setItems] = useState<OpportunityDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSaved = useCallback(async () => {
    const ids = getSavedIds();
    if (ids.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch each saved opportunity by id. Dataset is small for MVP so
      // parallel individual fetches are simpler than adding a bulk endpoint.
      const results = await Promise.all(
        ids.map(async (id) => {
          const res = await fetch(`/api/opportunities/${id}`);
          if (!res.ok) return null;
          const data = await res.json();
          return data.item as OpportunityDocument;
        })
      );
      setItems(results.filter((x): x is OpportunityDocument => x !== null));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSaved();
    // Re-sync if a save/unsave happens elsewhere on the page (or another tab)
    window.addEventListener("oppy_saved_changed", loadSaved);
    window.addEventListener("storage", loadSaved);
    return () => {
      window.removeEventListener("oppy_saved_changed", loadSaved);
      window.removeEventListener("storage", loadSaved);
    };
  }, [loadSaved]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Saved Opportunities</h1>
        <p className="text-sm text-gray-500 mt-1">
          Saved on this device only — no account needed.
        </p>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          Nothing saved yet. Browse opportunities and tap the bookmark icon to save them here.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((opp) => (
            <OpportunityCard key={opp._id} opportunity={opp} />
          ))}
        </div>
      )}
    </div>
  );
}

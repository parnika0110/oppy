"use client";

import { useState, useEffect, useCallback } from "react";
import { OpportunityDocument } from "@/types/opportunity";

const AVATAR_GRADIENTS: Record<string, string> = {
  Hackathon:   "linear-gradient(135deg, #D2C9EE 0%, #8B7DC7 100%)",
  Internship:  "linear-gradient(135deg, #F0C6A0 0%, #C98A4B 100%)",
  Fellowship:  "linear-gradient(135deg, #B3CDA8 0%, #6E9463 100%)",
  Scholarship: "linear-gradient(135deg, #ACCEDF 0%, #5D8BA3 100%)",
  Grant:       "linear-gradient(135deg, #E8D5C4 0%, #B8946C 100%)",
  Event:       "linear-gradient(135deg, #E8D0FF 0%, #9B6CC7 100%)",
};

export function DetailImage({ opp }: { opp: OpportunityDocument }) {
  const [imgError, setImgError] = useState(false);
  const [ogImage, setOgImage] = useState<string | null>(null);
  const [ogFailed, setOgFailed] = useState(false);
  const [fetchingOg, setFetchingOg] = useState(false);
  const gradient = AVATAR_GRADIENTS[opp.category] ?? AVATAR_GRADIENTS.Event;
  const hasPrimaryImage = Boolean(opp.imageUrl) && !imgError;

  const sourceUrl = (opp as any).sourceUrl || (opp as any).applicationLink || (opp as any).officialSourceUrl;

  const fetchOg = useCallback(async () => {
    if (ogImage || fetchingOg || !sourceUrl || !sourceUrl.startsWith("http")) return;
    setFetchingOg(true);
    try {
      const res = await fetch(`/api/og-image?url=${encodeURIComponent(sourceUrl)}`);
      const data = await res.json();
      if (data.imageUrl) {
        setOgImage(data.imageUrl);
      }
    } catch {
      // silently fail
    }
  }, [sourceUrl, ogImage, fetchingOg]);

  useEffect(() => {
    if (imgError && sourceUrl) {
      fetchOg();
    }
  }, [imgError, sourceUrl, fetchOg]);

  const hasOgImage = Boolean(ogImage) && !ogFailed;
  const showImage = hasPrimaryImage || hasOgImage;

  return (
    <div className="relative w-full flex items-end p-6" style={{ background: gradient, aspectRatio: '16/7' }}>
      {showImage ? (
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hasPrimaryImage ? opp.imageUrl! : ogImage!}
            alt={opp.imageAlt || `${opp.title} cover`}
            className="w-full h-full object-cover"
            onError={() => {
              if (hasPrimaryImage) setImgError(true);
              else setOgFailed(true);
            }}
          />
        </div>
      ) : (
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center font-display font-bold text-3xl shadow-sm"
          style={{ background: "rgba(255,255,255,0.85)", color: "var(--ink)" }}
        >
          {opp.organization.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}

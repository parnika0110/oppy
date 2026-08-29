"use client";

import dynamic from "next/dynamic";

/**
 * Dynamic import of OppyNetworkLogo with SSR disabled.
 * Three.js requires the DOM/canvas API which isn't available during SSR.
 * This wrapper ensures the 3D scene only renders on the client.
 */
const OppyNetworkLogo = dynamic(() => import("./OppyNetworkLogo"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Minimal static placeholder matching the constellation O */}
      <svg viewBox="0 0 7 7" width="100%" height="100%" style={{ maxWidth: 340, maxHeight: 340, opacity: 0.25 }}>
        {/* 5 perimeter nodes */}
        <line x1="3.5" y1="1.7" x2="5.0" y2="2.9" stroke="#8B7DC7" strokeWidth="0.04" opacity="0.5" />
        <line x1="5.0" y1="2.9" x2="4.7" y2="4.8" stroke="#8B7DC7" strokeWidth="0.04" opacity="0.5" />
        <line x1="4.7" y1="4.8" x2="3.2" y2="5.2" stroke="#8B7DC7" strokeWidth="0.04" opacity="0.5" />
        <line x1="3.2" y1="5.2" x2="2.1" y2="3.3" stroke="#8B7DC7" strokeWidth="0.04" opacity="0.5" />
        <line x1="2.1" y1="3.3" x2="3.5" y2="1.7" stroke="#8B7DC7" strokeWidth="0.04" opacity="0.5" />
        {/* Crossings */}
        <line x1="3.5" y1="1.7" x2="4.7" y2="4.8" stroke="#8B7DC7" strokeWidth="0.03" opacity="0.3" />
        <line x1="5.0" y1="2.9" x2="2.1" y2="3.3" stroke="#8B7DC7" strokeWidth="0.03" opacity="0.3" />
        {/* Nodes */}
        <circle cx="3.5" cy="1.7" r="0.18" fill="#8B7DC7" opacity="0.6" />
        <circle cx="5.0" cy="2.9" r="0.12" fill="#8B7DC7" opacity="0.6" />
        <circle cx="4.7" cy="4.8" r="0.12" fill="#D2C9EE" opacity="0.6" />
        <circle cx="3.2" cy="5.2" r="0.18" fill="#8B7DC7" opacity="0.6" />
        <circle cx="2.1" cy="3.3" r="0.12" fill="#C98A4B" opacity="0.7" />
        <circle cx="3.8" cy="3.1" r="0.06" fill="#FAF6EF" opacity="0.5" />
      </svg>
    </div>
  ),
});

export default function OppyNetworkLogoWrapper(props: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <OppyNetworkLogo {...props} />;
}

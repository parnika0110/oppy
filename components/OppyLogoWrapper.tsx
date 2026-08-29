"use client";

import dynamic from "next/dynamic";

/**
 * Dynamic import of OppyLogoAnimated with SSR disabled.
 * Three.js requires the DOM/canvas API which isn't available during SSR.
 */
const OppyLogoAnimated = dynamic(() => import("./OppyLogoAnimated"), {
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
      {/* Static SVG placeholder while loading */}
      <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ maxWidth: 380, maxHeight: 380, opacity: 0.2 }}>
        <path
          d="M 91.8 63.6 A 44 44 0 1 1 90.8 33.5 L 77.8 38.8 A 30 30 0 1 0 78.5 59.3 Z"
          fill="#211D2E"
        />
      </svg>
    </div>
  ),
});

export default function OppyLogoWrapper(props: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <OppyLogoAnimated {...props} />;
}

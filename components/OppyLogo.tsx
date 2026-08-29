/**
 * OPPY Logo — "The Opening"
 *
 * A bold O with a vertical slit/opening on the right side.
 * The opening is a doorway into opportunity — negative space that IS the concept.
 *
 * Exports:
 *   OppyMark       — standalone O icon (hero, navbar)
 *   OppyWordmark   — full "OPPY" wordmark
 *   OppyFavicon    — simplified for 16–32px
 */

// ── O Mark Geometry ──────────────────────────────────────────────────────
// Center: (50, 50)   Outer R: 44   Inner R: 30   Ring thickness: 14
// Opening: right side, slightly wider at top (asymmetrical)

const OUTER_R = 44;
const INNER_R = 30;
const CX = 50;
const CY = 50;

// Gap angles (from 3 o'clock, SVG y-down)
// Top: -22° (above horizontal)   Bottom: +18° (below horizontal)
// Asymmetry: top part is 22°, bottom part is 18°
const GAP_TOP_ANGLE = -22 * (Math.PI / 180);
const GAP_BOT_ANGLE = 18 * (Math.PI / 180);

function polarToXY(cx: number, cy: number, r: number, angle: number): [number, number] {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

const outerTop = polarToXY(CX, CY, OUTER_R, GAP_TOP_ANGLE);
const outerBot = polarToXY(CX, CY, OUTER_R, GAP_BOT_ANGLE);
const innerTop = polarToXY(CX, CY, INNER_R, GAP_TOP_ANGLE);
const innerBot = polarToXY(CX, CY, INNER_R, GAP_BOT_ANGLE);

// O ring path: outer arc (clockwise, large) → inner arc (counter-clockwise, large)
const O_RING_PATH = [
  `M ${outerTop[0].toFixed(1)} ${outerTop[1].toFixed(1)}`,
  `A ${OUTER_R} ${OUTER_R} 0 1 0 ${outerBot[0].toFixed(1)} ${outerBot[1].toFixed(1)}`,
  `L ${innerBot[0].toFixed(1)} ${innerBot[1].toFixed(1)}`,
  `A ${INNER_R} ${INNER_R} 0 1 1 ${innerTop[0].toFixed(1)} ${innerTop[1].toFixed(1)}`,
  'Z',
].join(' ');

// Portal opening shape (the gap area — for gradient fill)
const PORTAL_PATH = [
  `M ${outerTop[0].toFixed(1)} ${outerTop[1].toFixed(1)}`,
  `L ${innerTop[0].toFixed(1)} ${innerTop[1].toFixed(1)}`,
  `L ${innerBot[0].toFixed(1)} ${innerBot[1].toFixed(1)}`,
  `L ${outerBot[0].toFixed(1)} ${outerBot[1].toFixed(1)}`,
  'Z',
].join(' ');

// ── Gradient ID (unique per instance) ────────────────────────────────────
let _gradId = 0;

// ── OppyMark — Standalone O Icon ─────────────────────────────────────────

export function OppyMark({
  size = 48,
  className,
  style,
  id,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}) {
  const gradId = `oppy-portal-grad-${id ?? ++_gradId}`;
  const shadowId = `oppy-portal-glow-${id ?? _gradId}`;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      role="img"
      aria-label="OPPY"
    >
      <defs>
        {/* Portal gradient — lavender to peach, suggesting warmth beyond */}
        <linearGradient id={gradId} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C98A4B" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#D2C9EE" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#8B7DC7" stopOpacity="0.5" />
        </linearGradient>
        {/* Subtle glow behind the portal opening */}
        <radialGradient id={shadowId} cx="0.85" cy="0.5" r="0.2">
          <stop offset="0%" stopColor="#C98A4B" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#C98A4B" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Subtle ambient glow behind the opening */}
      <circle cx={CX} cy={CY} r={OUTER_R + 4} fill={`url(#${shadowId})`} />

      {/* The O ring */}
      <path d={O_RING_PATH} fill="#211D2E" />

      {/* Portal gradient fill in the opening */}
      <path d={PORTAL_PATH} fill={`url(#${gradId})`} />

      {/* Threshold line — subtle floor suggestion at the bottom of the opening */}
      <line
        x1={innerBot[0]}
        y1={innerBot[1]}
        x2={outerBot[0]}
        y2={outerBot[1]}
        stroke="#C98A4B"
        strokeWidth="0.6"
        opacity="0.3"
      />
    </svg>
  );
}

// ── OppyWordmark — Full "OPPY" Text + Mark ───────────────────────────────

export function OppyWordmark({
  className,
  style,
  markSize = 36,
}: {
  className?: string;
  style?: React.CSSProperties;
  markSize?: number;
}) {
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.15em',
        ...style,
      }}
      role="img"
      aria-label="OPPY"
    >
      <OppyMark size={markSize} />
      <span
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: `${markSize * 0.72}px`,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: '#211D2E',
          lineHeight: 1,
        }}
      >
        PPY
      </span>
    </div>
  );
}

// ── OppyFavicon — Simplified for 16–32px ─────────────────────────────────
// Same O geometry, simplified: no gradient, no glow, just the mark

export function OppyFavicon({ size = 32 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={O_RING_PATH} fill="#211D2E" />
    </svg>
  );
}

// ── Default export — the standalone mark ──────────────────────────────────
export default OppyMark;

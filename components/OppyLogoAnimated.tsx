"use client";

import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── O Mark Geometry (matching OppyLogo.tsx) ──────────────────────────────
const OUTER_R = 44;
const INNER_R = 30;
const CX = 50;
const CY = 50;
const GAP_TOP_ANGLE = -22 * (Math.PI / 180);
const GAP_BOT_ANGLE = 18 * (Math.PI / 180);

// Scale everything down for 3D scene (world units ~4)
const SCALE = 0.04;

function polarXY(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

const outerTop = polarXY(CX, CY, OUTER_R, GAP_TOP_ANGLE);
const outerBot = polarXY(CX, CY, OUTER_R, GAP_BOT_ANGLE);
const innerTop = polarXY(CX, CY, INNER_R, GAP_TOP_ANGLE);
const innerBot = polarXY(CX, CY, INNER_R, GAP_BOT_ANGLE);

// ── Ring Shape (flat, for ExtrudeGeometry) ───────────────────────────────

function createRingShape(): THREE.Shape {
  const shape = new THREE.Shape();

  // Outer arc: counter-clockwise from GAP_BOT to GAP_TOP + 2π (long way)
  shape.moveTo(outerBot[0], outerBot[1]);
  shape.absarc(CX, CY, OUTER_R, GAP_BOT_ANGLE, GAP_TOP_ANGLE + 2 * Math.PI, true);

  // Inner hole: clockwise from GAP_BOT to GAP_TOP + 2π (long way)
  const hole = new THREE.Path();
  hole.moveTo(innerBot[0], innerBot[1]);
  hole.absarc(CX, CY, INNER_R, GAP_BOT_ANGLE, GAP_TOP_ANGLE + 2 * Math.PI, false);
  shape.holes.push(hole);

  return shape;
}

// ── Portal Glow Mesh ─────────────────────────────────────────────────────
// A subtle glow plane inside the opening

function PortalGlow({ opacity }: { opacity: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Position the glow at the center of the opening
  const midX = ((outerTop[0] + outerBot[0]) / 2 + (innerTop[0] + innerBot[0]) / 2) / 2;
  const midY = ((outerTop[1] + outerBot[1]) / 2 + (innerTop[1] + innerBot[1]) / 2) / 2;

  useFrame(() => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, opacity, 0.05);
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[(midX - CX) * SCALE, (CY - midY) * SCALE, 0.05]}
    >
      <planeGeometry args={[1.5, 3]} />
      <meshBasicMaterial
        color="#C98A4B"
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

// ── Constellation Scene ──────────────────────────────────────────────────

function LogoScene({
  reducedMotion,
  hovered,
}: {
  reducedMotion: boolean;
  hovered: React.MutableRefObject<boolean>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const startTime = useRef(Date.now());
  const [ready, setReady] = useState(false);

  // Animation state
  const stateRef = useRef({
    opacity: 0,
    scale: 0.8,
    portalOpacity: 0,
    idleTime: 0,
    breathPhase: 0,
  });

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Extruded ring geometry
  const geometry = useMemo(() => {
    const shape = createRingShape();
    const extrudeSettings = {
      depth: 6,
      bevelEnabled: true,
      bevelThickness: 1.0,
      bevelSize: 1.0,
      bevelSegments: 3,
    };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Center and scale the geometry
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const cx = (bb.min.x + bb.max.x) / 2;
    const cy = (bb.min.y + bb.max.y) / 2;
    geo.translate(-cx, -cy, -3);
    // Scale from viewBox coords (0-100) to world units (~4)
    geo.scale(SCALE, SCALE, SCALE);
    return geo;
  }, []);

  // Mouse parallax
  const mousePos = useRef({ x: 0, y: 0 });

  useFrame((state) => {
    if (!ready || !groupRef.current) return;

    const now = Date.now();
    const elapsed = reducedMotion ? 10 : (now - startTime.current) / 1000;
    const time = state.clock.getElapsedTime();
    const s = stateRef.current;

    // ── Entrance animation ───────────────────────────────────────────
    if (elapsed < 2.5) {
      // Ring fades in and scales up (0 → 1.5s)
      const t = Math.min(elapsed / 1.5, 1);
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      s.opacity = ease;
      s.scale = 0.85 + ease * 0.15;
    } else if (elapsed < 3.5) {
      // Portal light fades in (1.5 → 3s)
      const t = Math.min((elapsed - 1.5) / 1.5, 1);
      s.portalOpacity = t * 0.25;
      s.opacity = 1;
      s.scale = 1;
    } else {
      // Idle
      s.opacity = 1;
      s.scale = 1;

      // Subtle breathing
      if (!reducedMotion) {
        s.scale += Math.sin(time * 0.6) * 0.005;
      }

      // Portal pulse (every 5-7 seconds)
      const cycleTime = elapsed % 6;
      if (cycleTime < 0.8) {
        s.portalOpacity = 0.25 + Math.sin(cycleTime / 0.8 * Math.PI) * 0.1;
      } else {
        s.portalOpacity = 0.25;
      }
    }

    // Hover: brighten portal slightly
    if (hovered.current && elapsed > 3) {
      s.portalOpacity += 0.08;
      s.scale += 0.008;
    }

    // Reduced motion: skip straight to final state
    if (reducedMotion) {
      s.opacity = 1;
      s.scale = 1;
      s.portalOpacity = 0.25;
    }

    // ── Apply to mesh ────────────────────────────────────────────────
    if (meshRef.current) {
      meshRef.current.scale.setScalar(s.scale);
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, s.opacity, 0.1);
    }

    // ── Subtle mouse parallax (idle only) ────────────────────────────
    if (groupRef.current && !reducedMotion && elapsed > 3) {
      const mx = mousePos.current.x;
      const my = mousePos.current.y;
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        mx * 0.04,
        0.03
      );
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        -my * 0.03,
        0.03
      );
    }
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 4, 5]} intensity={0.5} color="#FAF6EF" />
      <pointLight position={[-2, 0, 3]} intensity={0.2} color="#D2C9EE" />

      {/* The O mark */}
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial
          color="#211D2E"
          transparent
          opacity={0}
          roughness={0.4}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Portal glow */}
      <PortalGlow opacity={stateRef.current.portalOpacity} />
    </group>
  );
}

// ── Static SVG fallback ──────────────────────────────────────────────────
// Simplified for reduced motion

function StaticMark() {
  // Same O geometry as SVG
  const r1 = OUTER_R;
  const r2 = INNER_R;

  return (
    <svg
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      style={{ maxWidth: 380, maxHeight: 380 }}
      role="img"
      aria-label="OPPY — opportunity discovery"
    >
      <defs>
        <linearGradient id="oppy-portal-static" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C98A4B" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#8B7DC7" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* O ring */}
      <path
        d={`M ${outerBot[0]} ${outerBot[1]} A ${r1} ${r1} 0 1 1 ${outerTop[0]} ${outerTop[1]} L ${innerTop[0]} ${innerTop[1]} A ${r2} ${r2} 0 1 0 ${innerBot[0]} ${innerBot[1]} Z`}
        fill="#211D2E"
      />

      {/* Portal gradient */}
      <path
        d={`M ${outerTop[0]} ${outerTop[1]} L ${innerTop[0]} ${innerTop[1]} L ${innerBot[0]} ${innerBot[1]} L ${outerBot[0]} ${outerBot[1]} Z`}
        fill="url(#oppy-portal-static)"
      />
    </svg>
  );
}

// ── Main Component ───────────────────────────────────────────────────────

export default function OppyLogoAnimated({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const mousePos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mounted, setMounted] = useState(false);
  const hovered = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mousePos.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mousePos.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    },
    []
  );

  // Reduced motion: static SVG
  if (reducedMotion && mounted) {
    return (
      <div
        className={className}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...style,
        }}
        role="img"
        aria-label="OPPY — opportunity discovery"
      >
        <StaticMark />
      </div>
    );
  }

  // Full 3D version
  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        cursor: "default",
        ...style,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => { hovered.current = true; }}
      onMouseLeave={() => { hovered.current = false; }}
      role="img"
      aria-label="OPPY — opportunity discovery"
    >
      {mounted && (
        <Canvas
          camera={{ position: [0, 0, 5], fov: 35 }}
          dpr={[1, 1.5]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "low-power",
          }}
          style={{ background: "transparent" }}
        >
          <LogoScene reducedMotion={reducedMotion} hovered={hovered} />
        </Canvas>
      )}
    </div>
  );
}

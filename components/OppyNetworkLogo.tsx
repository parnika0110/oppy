"use client";

import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Exact Node Positions ─────────────────────────────────────────────────
// A = top anchor, B = upper-right, C = lower-right
// D = bottom anchor, E = lower-left (peach accent), F = user node

interface NodeDef {
  id: string;
  final: [number, number, number];
  size: number;
  color: string;
  scatterSeed: [number, number, number];
}

const NODES: NodeDef[] = [
  { id: "A", final: [0.0, 1.8, 0.0], size: 0.14, color: "#8B7DC7", scatterSeed: [-2.1, 2.4, 0.8] },
  { id: "B", final: [1.5, 0.6, 0.0], size: 0.09, color: "#8B7DC7", scatterSeed: [2.6, 1.8, -0.5] },
  { id: "C", final: [1.2, -1.3, 0.0], size: 0.09, color: "#D2C9EE", scatterSeed: [2.2, -2.0, 0.3] },
  { id: "D", final: [-0.3, -1.7, 0.0], size: 0.14, color: "#8B7DC7", scatterSeed: [-1.8, -2.5, -0.7] },
  { id: "E", final: [-1.4, -0.3, 0.0], size: 0.09, color: "#C98A4B", scatterSeed: [-2.8, 0.2, 0.6] },
  { id: "F", final: [0.3, 0.1, 0.0], size: 0.05, color: "#FAF6EF", scatterSeed: [0.0, 0.0, 0.0] },
];

// ── Connection Graph ─────────────────────────────────────────────────────
// Perimeter: A→B, B→C, C→D, D→E, E→A
// Interior crossings: A→C, B→E
// User links: F→B, F→E

interface ConnDef {
  from: number; // index into NODES
  to: number;
  drawOrder: number; // 1-9, lower = drawn first
  type: "perimeter" | "crossing" | "user";
}

const CONNECTIONS: ConnDef[] = [
  { from: 0, to: 1, drawOrder: 1, type: "perimeter" }, // A→B
  { from: 1, to: 2, drawOrder: 2, type: "perimeter" }, // B→C
  { from: 2, to: 3, drawOrder: 3, type: "perimeter" }, // C→D
  { from: 3, to: 4, drawOrder: 4, type: "perimeter" }, // D→E
  { from: 4, to: 0, drawOrder: 5, type: "perimeter" }, // E→A
  { from: 0, to: 2, drawOrder: 6, type: "crossing" },  // A→C
  { from: 1, to: 4, drawOrder: 7, type: "crossing" },  // B→E
  { from: 5, to: 1, drawOrder: 8, type: "user" },      // F→B
  { from: 5, to: 4, drawOrder: 9, type: "user" },      // F→E
];

// ── Animation Phase Timing ───────────────────────────────────────────────
// Phase 1: SCATTER   0–2s     Nodes appear, drift, converge toward final positions
// Phase 2: CONNECT   2–4s     Lines draw progressively
// Phase 3: MATCH     4–6s     F appears with pulse, constellation reorganizes
// Phase 4: FORM      6–8s     Everything eases to final coordinates
// Phase 5: IDLE      8s+      Subtle breathing, occasional peripheral signal

const PHASE = { SCATTER: 0, CONNECT: 1, MATCH: 2, FORM: 3, IDLE: 4 } as const;
const PHASE_END = [2, 4, 6, 8, Infinity];

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

// ── Determine current phase from elapsed time ────────────────────────────
function getPhase(elapsed: number): number {
  for (let i = PHASE_END.length - 1; i >= 0; i--) {
    if (elapsed >= (i === 0 ? 0 : PHASE_END[i - 1])) return i;
  }
  return 0;
}

function phaseProgress(elapsed: number, phaseIdx: number): number {
  const start = phaseIdx === 0 ? 0 : PHASE_END[phaseIdx - 1];
  const end = PHASE_END[phaseIdx];
  return clamp01((elapsed - start) / (end - start));
}

// ── Network Scene ────────────────────────────────────────────────────────
function ConstellationScene({
  reducedMotion,
  mousePos,
}: {
  reducedMotion: boolean;
  mousePos: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  // lineRefs removed — lines are created imperatively and accessed via lineObjects
  const startTime = useRef(Date.now());
  const [ready, setReady] = useState(false);

  // Node target positions during animation
  const nodePositions = useRef<THREE.Vector3[]>(
    NODES.map((n) => new THREE.Vector3(...n.scatterSeed))
  );
  const nodeOpacities = useRef<number[]>(NODES.map(() => 0));
  const nodeScales = useRef<number[]>(NODES.map(() => 0.01));

  // Line draw progress (0 = not drawn, 1 = fully drawn)
  const lineDrawProgress = useRef<number[]>(CONNECTIONS.map(() => 0));

  // F pulse state
  const fPulseTime = useRef(-1); // -1 = not started
  // fPulseActive removed — pulse is tracked by fPulseTime alone

  // Peripheral signal state
  const peripheralTimer = useRef(0);
  const peripheralActive = useRef(false);
  const peripheralPos = useRef(new THREE.Vector3());
  const peripheralOpacity = useRef(0);
  const peripheralLineProgress = useRef(0);

  // Ready signal
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  // ── Build THREE.Line objects imperatively (avoids JSX <line> TS issues) ─
  const lineObjects = useMemo(() => {
    return CONNECTIONS.map((conn) => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(6); // 2 vertices × 3 components
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const color = conn.type === "crossing" ? "#8B7DC7" : conn.type === "user" ? "#D2C9EE" : "#8B7DC7";
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 });
      const line = new THREE.Line(geo, mat);
      line.visible = false;
      return line;
    });
  }, []);

  // Peripheral line (created imperatively)
  const peripheralLineObj = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(6);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({ color: "#D2C9EE", transparent: true, opacity: 0 });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    return line;
  }, []);

  // ── Animation loop ─────────────────────────────────────────────────────
  useFrame((state) => {
    if (!ready || !groupRef.current) return;

    const now = Date.now();
    const elapsed = reducedMotion ? 20 : (now - startTime.current) / 1000;
    const phase = getPhase(elapsed);
    const time = state.clock.getElapsedTime();

    // ── Mouse parallax (subtle group tilt) ─────────────────────────────
    const mx = mousePos.current.x;
    const my = mousePos.current.y;
    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        mx * 0.06,
        0.04
      );
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        -my * 0.04,
        0.04
      );
    }

    // ── Find nearest 1-2 nodes to cursor for interaction ───────────────
    // (Only in IDLE phase)
    const nearestIndices: number[] = [];
    if (phase >= PHASE.IDLE) {
      // Project mouse to approximate world position
      const worldX = mx * 2.0;
      const worldY = my * 2.4;
      const dists: { idx: number; dist: number }[] = [];
      for (let i = 0; i < 6; i++) {
        const p = nodePositions.current[i];
        const dx = p.x - worldX;
        const dy = p.y - worldY;
        dists.push({ idx: i, dist: Math.sqrt(dx * dx + dy * dy) });
      }
      dists.sort((a, b) => a.dist - b.dist);
      nearestIndices.push(dists[0].idx);
      if (dists[1].dist < 3.0) nearestIndices.push(dists[1].idx);
    }

    // ── Update node positions, opacity, scale ──────────────────────────
    for (let i = 0; i < 6; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      const def = NODES[i];
      const finalPos = new THREE.Vector3(...def.final);
      const scatterPos = new THREE.Vector3(...def.scatterSeed);
      let targetPos: THREE.Vector3;
      let targetOpacity: number;
      let targetScale: number;

      const isF = i === 5; // F = user node

      if (phase === PHASE.SCATTER) {
        // Phase 1: nodes appear and begin converging
        const p = phaseProgress(elapsed, 0);
        targetPos = new THREE.Vector3().lerpVectors(scatterPos, finalPos, easeInOutCubic(p));
        targetOpacity = easeInOutCubic(clamp01(p * 2.5)); // fade in during first 40%
        targetScale = easeInOutCubic(clamp01(p * 2.5));
        if (isF) {
          targetOpacity = 0; // F invisible during scatter
          targetScale = 0.01;
        }
      } else if (phase === PHASE.CONNECT) {
        // Phase 2: nodes at near-final positions, lines drawing
        const p = phaseProgress(elapsed, 1);
        targetPos = new THREE.Vector3().lerpVectors(scatterPos, finalPos, easeInOutCubic(clamp01(p * 0.7 + 0.3)));
        targetOpacity = 1;
        targetScale = 1;
        if (isF) {
          targetOpacity = 0;
          targetScale = 0.01;
        }
      } else if (phase === PHASE.MATCH) {
        // Phase 3: F appears, constellation reorganizes
        const p = phaseProgress(elapsed, 2);

        if (isF) {
          // F appears with pulse
          if (fPulseTime.current < 0) fPulseTime.current = elapsed;
          const pulseElapsed = elapsed - fPulseTime.current;
          const pulseDur = 0.6;
          const pulseT = clamp01(pulseElapsed / pulseDur);

          // Scale: 1 → 2.0 → 1
          if (pulseT < 0.5) {
            targetScale = 1 + easeInOutCubic(pulseT * 2) * 1.0;
          } else {
            targetScale = 2.0 - easeInOutCubic((pulseT - 0.5) * 2) * 1.0;
          }
          targetOpacity = easeInOutCubic(clamp01(p * 3)); // slightly slower reveal
          targetPos = finalPos.clone();
        } else {
          // Other nodes reorganize around F
          const shift = easeInOutCubic(clamp01(p * 2));
          targetPos = finalPos.clone();

          if (i === 1 || i === 4) {
            // B and E shift toward F
            const towardF = new THREE.Vector3(
              NODES[5].final[0] - finalPos.x,
              NODES[5].final[1] - finalPos.y,
              NODES[5].final[2] - finalPos.z
            ).normalize().multiplyScalar(0.18 * shift);
            targetPos.add(towardF);
          } else if (i === 0 || i === 2 || i === 3) {
            // A, C, D shift slightly outward (away from F center)
            const awayFromF = new THREE.Vector3(
              finalPos.x - NODES[5].final[0],
              finalPos.y - NODES[5].final[1],
              finalPos.z - NODES[5].final[2]
            ).normalize().multiplyScalar(0.10 * shift);
            targetPos.add(awayFromF);
          }
          targetOpacity = 1;
          targetScale = 1;
        }
      } else {
        // Phase 4 (FORM) + Phase 5 (IDLE): at final position
        targetPos = finalPos.clone();
        targetOpacity = 1;
        targetScale = isF ? 1 : 1;

        // Subtle idle breathing
        if (phase === PHASE.IDLE && !reducedMotion) {
          targetOpacity = 1 + Math.sin(time * 0.8 + i * 1.7) * 0.05;
          // Tiny depth oscillation
          targetPos.z += Math.sin(time * 0.5 + i * 2.1) * 0.015;
        }
      }

      // ── Apply mouse interaction to nearest nodes ────────────────────
      if (phase >= PHASE.IDLE && nearestIndices.includes(i)) {
        const worldX = mx * 2.0;
        const worldY = my * 2.4;
        const dx = worldX - targetPos.x;
        const dy = worldY - targetPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const influence = Math.max(0, 1 - dist / 3.0);
        targetPos.x += dx * influence * 0.06;
        targetPos.y += dy * influence * 0.06;
      }

      // Smooth interpolation
      mesh.position.lerp(targetPos, 0.1);
      const currentScale = mesh.scale.x;
      const newScale = THREE.MathUtils.lerp(currentScale, targetScale * def.size, 0.1);
      mesh.scale.setScalar(newScale);

      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, clamp01(targetOpacity), 0.08);

      // Hover brightening (nearest nodes)
      if (phase >= PHASE.IDLE && nearestIndices.includes(i)) {
        mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, 0.15, 0.08);
      } else {
        mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, 0, 0.08);
      }

      nodePositions.current[i].copy(mesh.position);
      nodeOpacities.current[i] = mat.opacity;
      nodeScales.current[i] = newScale;
    }

    // ── Update connection lines ────────────────────────────────────────
    for (let c = 0; c < CONNECTIONS.length; c++) {
      const conn = CONNECTIONS[c];
      const line = lineObjects[c];
      if (!line) continue;

      const posAttr = line.geometry.getAttribute("position") as THREE.BufferAttribute;
      const meshA = meshRefs.current[conn.from];
      const meshB = meshRefs.current[conn.to];
      if (!meshA || !meshB) continue;

      // Determine if this line should be drawing
      let targetDraw = 0;
      if (phase === PHASE.CONNECT) {
        const p = phaseProgress(elapsed, 1);
        // Lines draw sequentially during connect phase
        // Line with drawOrder N starts at (N-1)/9 of the phase, completes at N/9
        const lineStart = (conn.drawOrder - 1) / 9;
        const lineEnd = conn.drawOrder / 9;
        if (conn.type === "user") {
          // User lines only draw in MATCH phase
          targetDraw = 0;
        } else {
          targetDraw = clamp01((p - lineStart) / (lineEnd - lineStart));
        }
      } else if (phase === PHASE.MATCH) {
        const p = phaseProgress(elapsed, 2);
        if (conn.type === "user") {
          // User lines draw during MATCH
          const lineStart = conn.drawOrder === 8 ? 0.3 : 0.5;
          const lineEnd = conn.drawOrder === 8 ? 0.6 : 0.8;
          targetDraw = clamp01((p - lineStart) / (lineEnd - lineStart));
        } else {
          targetDraw = 1;
        }
      } else if (phase >= PHASE.FORM) {
        targetDraw = 1;
      }

      // Smooth draw progress
      lineDrawProgress.current[c] = THREE.MathUtils.lerp(
        lineDrawProgress.current[c],
        targetDraw,
        0.1
      );

      const progress = lineDrawProgress.current[c];

      // Interpolate line endpoints based on draw progress
      const ax = meshA.position.x;
      const ay = meshA.position.y;
      const az = meshA.position.z;
      const bx = meshB.position.x;
      const by = meshB.position.y;
      const bz = meshB.position.z;

      // Line draws from A toward B
      const endX = ax + (bx - ax) * progress;
      const endY = ay + (by - ay) * progress;
      const endZ = az + (bz - az) * progress;

      posAttr.setXYZ(0, ax, ay, az);
      posAttr.setXYZ(1, endX, endY, endZ);
      posAttr.needsUpdate = true;

      // Line visibility
      line.visible = progress > 0.01;

      // Line material opacity
      const mat = line.material as THREE.LineBasicMaterial;
      const baseOpacity = conn.type === "crossing" ? 0.45 : conn.type === "user" ? 0.5 : 0.55;
      // Hover brightening for connected lines
      const isHovered = nearestIndices.includes(conn.from) || nearestIndices.includes(conn.to);
      const hoverBoost = isHovered && phase >= PHASE.IDLE ? 0.15 : 0;
      mat.opacity = THREE.MathUtils.lerp(
        mat.opacity,
        progress * (baseOpacity + hoverBoost),
        0.08
      );
    }

    // ── Peripheral opportunity signal ──────────────────────────────────
    if (phase >= PHASE.IDLE && !reducedMotion) {
      peripheralTimer.current += state.clock.getDelta();

      if (!peripheralActive.current && peripheralTimer.current > 6) {
        // Spawn a new peripheral signal
        peripheralActive.current = true;
        peripheralTimer.current = 0;
        peripheralOpacity.current = 0;
        peripheralLineProgress.current = 0;

        // Random position on the outer edge
        const angle = Math.random() * Math.PI * 2;
        const r = 2.5 + Math.random() * 0.5;
        peripheralPos.current.set(Math.cos(angle) * r, Math.sin(angle) * r, (Math.random() - 0.5) * 0.5);
      }

      if (peripheralActive.current) {
        peripheralOpacity.current += 0.02;
        if (peripheralOpacity.current > 0.6) {
          peripheralOpacity.current -= 0.015;
          peripheralLineProgress.current = THREE.MathUtils.lerp(
            peripheralLineProgress.current,
            Math.random() > 0.4 ? 0.7 : 0,
            0.02
          );
        }
        if (peripheralOpacity.current <= 0) {
          peripheralActive.current = false;
          peripheralOpacity.current = 0;
        }

        // Update peripheral dot mesh
        const periMesh = meshRefs.current[6]; // index 6 = peripheral
        if (periMesh) {
          periMesh.position.copy(peripheralPos.current);
          const mat = periMesh.material as THREE.MeshStandardMaterial;
          mat.opacity = peripheralOpacity.current;
          periMesh.scale.setScalar(0.025 * peripheralOpacity.current / 0.6);
          periMesh.visible = peripheralActive.current && peripheralOpacity.current > 0.01;
        }

        // Update peripheral line (from nearest perimeter node)
        if (peripheralActive.current && peripheralLineProgress.current > 0.01) {
          // Find nearest perimeter node to the peripheral signal
          let nearestPerim = 0;
          let nearestDist = Infinity;
          for (let i = 0; i < 5; i++) {
            const p = nodePositions.current[i];
            const d = p.distanceTo(peripheralPos.current);
            if (d < nearestDist) {
              nearestDist = d;
              nearestPerim = i;
            }
          }
          const nearPos = nodePositions.current[nearestPerim];
          const pAttr = peripheralLineObj.geometry.getAttribute("position") as THREE.BufferAttribute;
          const lp = peripheralLineProgress.current;
          pAttr.setXYZ(0, nearPos.x, nearPos.y, nearPos.z);
          pAttr.setXYZ(
            1,
            nearPos.x + (peripheralPos.current.x - nearPos.x) * lp,
            nearPos.y + (peripheralPos.current.y - nearPos.y) * lp,
            nearPos.z + (peripheralPos.current.z - nearPos.z) * lp
          );
          pAttr.needsUpdate = true;
        }
      } else {
        const periMesh = meshRefs.current[6];
        if (periMesh) periMesh.visible = false;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Lighting — soft, editorial */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 3, 4]} intensity={0.6} color="#FAF6EF" />
      <pointLight position={[-1, 1, 3]} intensity={0.25} color="#D2C9EE" />

      {/* 6 constellation nodes + 1 peripheral signal node */}
      {NODES.map((def, i) => (
        <mesh
          key={def.id}
          ref={(el) => { meshRefs.current[i] = el; }}
          position={def.scatterSeed}
        >
          <sphereGeometry args={[1, 20, 20]} />
          <meshStandardMaterial
            color={def.color}
            transparent
            opacity={0}
            roughness={0.35}
            metalness={0.05}
            emissive={def.color}
            emissiveIntensity={0}
          />
        </mesh>
      ))}

      {/* Peripheral signal node (hidden by default) */}
      <mesh ref={(el) => { meshRefs.current[6] = el; }} visible={false}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial
          color="#D2C9EE"
          transparent
          opacity={0}
          roughness={0.5}
          metalness={0}
        />
      </mesh>

      {/* 9 connection lines (created imperatively to avoid TS JSX typing issues) */}
      {lineObjects.map((lineObj, i) => (
        <primitive
          key={`line-${i}`}
          
          object={lineObj}
        />
      ))}

      {/* Peripheral signal line */}
      <primitive object={peripheralLineObj} />
    </group>
  );
}

// ── Static SVG for reduced motion ────────────────────────────────────────
// Uses exact same node positions and connection graph

function ConstellationSVG({ size }: { size?: number }) {
  const s = size || 340;
  // Scale factor: map node coordinates (-3 to 3 range) to SVG viewBox
  const svgSize = 7;
  const cx = svgSize / 2;
  const cy = svgSize / 2;

  const toSVG = (x: number, y: number): [number, number] => [cx + x, cy - y];

  const nodePositions = NODES.map((n) => toSVG(n.final[0], n.final[1]));

  return (
    <svg
      viewBox={`0 0 ${svgSize} ${svgSize}`}
      width={s}
      height={s}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Connections */}
      {CONNECTIONS.map((conn, i) => {
        const [x1, y1] = nodePositions[conn.from];
        const [x2, y2] = nodePositions[conn.to];
        const opacity = conn.type === "crossing" ? 0.4 : 0.5;
        return (
          <line
            key={`c${i}`}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#8B7DC7"
            strokeWidth={0.035}
            opacity={opacity}
          />
        );
      })}

      {/* Nodes */}
      {NODES.map((n, i) => {
        const [x, y] = nodePositions[i];
        // Scale radius for SVG: node size 0.14 maps to ~0.18 SVG units
        const r = n.size * 1.3;
        return (
          <circle
            key={n.id}
            cx={x} cy={y} r={r}
            fill={n.color}
            opacity={0.9}
          />
        );
      })}
    </svg>
  );
}

// ── Favicon/small-size SVG ───────────────────────────────────────────────
// Simplified for 16-32px: emphasizes O silhouette + X crossing

export function ConstellationFavicon({ size = 32 }: { size?: number }) {
  const svgSize = 64;

  // Simplified node positions for favicon
  // O perimeter (5 points) + simplified crossings
  const nodes: [number, number, string, number][] = [
    [32, 8, "#8B7DC7", 5],    // A top
    [54, 22, "#8B7DC7", 3.5], // B upper-right
    [50, 52, "#D2C9EE", 3.5], // C lower-right
    [28, 56, "#8B7DC7", 5],   // D bottom
    [10, 38, "#C98A4B", 3.5], // E lower-left (peach)
  ];

  // Connections
  const conns: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 0], // perimeter
    [0, 2], [1, 4], // crossings (X)
  ];

  return (
    <svg
      viewBox={`0 0 ${svgSize} ${svgSize}`}
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Connections */}
      {conns.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a][0]} y1={nodes[a][1]}
          x2={nodes[b][0]} y2={nodes[b][1]}
          stroke="#8B7DC7"
          strokeWidth={i >= 5 ? 1.5 : 1.8}
          opacity={i >= 5 ? 0.5 : 0.6}
        />
      ))}

      {/* Nodes */}
      {nodes.map(([x, y, color, r], i) => (
        <circle
          key={i}
          cx={x} cy={y} r={r}
          fill={color}
        />
      ))}

      {/* Tiny user dot */}
      <circle cx={35} cy={28} r={2} fill="#FAF6EF" opacity={0.9} />
    </svg>
  );
}

// ── Main Component ───────────────────────────────────────────────────────
export default function OppyNetworkLogo({
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

  // ── Reduced motion: static SVG ────────────────────────────────────────
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
        aria-label="OPPY — opportunity discovery constellation"
      >
        <ConstellationSVG />
      </div>
    );
  }

  // ── Full 3D version ───────────────────────────────────────────────────
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
      role="img"
      aria-label="OPPY — opportunity discovery constellation"
    >
      {mounted && (
        <Canvas
          camera={{ position: [0, 0, 5.5], fov: 40 }}
          dpr={[1, 1.5]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "low-power",
          }}
          style={{ background: "transparent" }}
        >
          <ConstellationScene reducedMotion={reducedMotion} mousePos={mousePos} />
        </Canvas>
      )}
    </div>
  );
}

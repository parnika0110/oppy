/**
 * esbuild configuration for bundling the OPPY ingestion Lambda.
 *
 * Produces a single lambda/dist/handler.js file that can be deployed
 * to AWS Lambda with all dependencies included.
 *
 * Run: npx tsx lambda/esbuild.config.ts
 * Output: lambda/dist/handler.js
 */

import { build } from "esbuild";
import path from "path";

const isWatch = process.argv.includes("--watch");

async function main() {
  console.log("[Lambda Build] Bundling ingestion handler...");

  await build({
    entryPoints: [path.resolve(__dirname, "ingestion.ts")],
    bundle: true,
    platform: "node",
    target: "node20",
    outfile: path.resolve(__dirname, "dist", "handler.js"),
    format: "cjs",
    sourcemap: false,
    minify: false,
    metafile: true,

    // Resolve the @/ path alias to the project root
    alias: {
      "@": path.resolve(__dirname, ".."),
    },

    // External packages that should NOT be bundled.
    // These are either:
    // - provided by the Lambda runtime (crypto, etc.)
    // - not needed by the ingestion pipeline
    // - problematic to bundle (native modules)
    external: [
      // Auth-related (not needed by ingestion)
      "bcryptjs",
      // Next.js (not needed by standalone Lambda)
      "next",
      "next/navigation",
      "next/server",
      "react",
      "react-dom",
      // Three.js (not needed by ingestion)
      "three",
      "@react-three/fiber",
      "@react-three/drei",
    ],

    // Define Node.js globals
    define: {
      "process.env.NODE_ENV": '"production"',
    },

    // Log level
    logLevel: "info",

    // Tree-shake unused code
    treeShaking: true,
  });

  console.log("[Lambda Build] ✓ Bundle created at lambda/dist/handler.js");

  if (!isWatch) {
    // Print bundle size
    const fs = await import("fs");
    const stats = fs.statSync(path.resolve(__dirname, "dist", "handler.js"));
    console.log(`[Lambda Build] Bundle size: ${(stats.size / 1024).toFixed(1)} KB`);
  }
}

main().catch((err) => {
  console.error("[Lambda Build] Build failed:", err);
  process.exit(1);
});

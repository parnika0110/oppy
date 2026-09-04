/**
 * Lightweight structural tests for scripts/deploy-ingestion-lambda.sh.
 *
 * The deploy script must support a deployment-only mode (SKIP_JSEARCH_TEST=1)
 * that skips the live JSearch smoke test so quota is never consumed during a
 * plain code/config deployment. These tests assert the guard exists and that
 * the Lambda invocation is only reachable behind it — without invoking AWS.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const scriptPath = join(process.cwd(), "scripts", "deploy-ingestion-lambda.sh");
const script = readFileSync(scriptPath, "utf8").replace(/\r/g, "");

describe("deploy-ingestion-lambda.sh", () => {
  it("defines the SKIP_JSEARCH_TEST skip flag with a safe default", () => {
    expect(script).toContain(
      'SKIP_JSEARCH_TEST="${SKIP_JSEARCH_TEST:-0}"'
    );
  });

  it("guards the live JSearch invocation behind the skip flag", () => {
    const guardIndex = script.indexOf('if [ "$SKIP_JSEARCH_TEST"');
    const skipMessageIndex = script.indexOf("Single-source JSearch invocation — SKIPPED");
    const invokeIndex = script.indexOf("aws lambda invoke");

    expect(guardIndex).toBeGreaterThan(-1);
    expect(skipMessageIndex).toBeGreaterThan(guardIndex);
    // The first invocation (the Step 6 smoke test) must come after the guard.
    expect(invokeIndex).toBeGreaterThan(guardIndex);
    // The guard must be closed (fi) after the invocation block.
    expect(script.indexOf("\nfi", invokeIndex)).toBeGreaterThan(invokeIndex);
  });

  it("preserves the Windows Git Bash response decoding", () => {
    expect(script).toContain("--cli-binary-format raw-in-base64-out");
    expect(script).toContain("export RESPONSE_FILE=$(cygpath -w");
    expect(script).toContain("rm -f \"$RESPONSE_FILE\"");
  });

  it("documents the skip-mode usage", () => {
    expect(script).toContain("SKIP_JSEARCH_TEST=1 bash scripts/deploy-ingestion-lambda.sh");
  });
});
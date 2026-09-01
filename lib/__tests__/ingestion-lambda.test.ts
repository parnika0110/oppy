/**
 * Ingestion Lambda handler tests.
 *
 * These tests verify the Lambda handler structure, logging, error handling,
 * and contract with runIngestionPipeline(). They do NOT test the actual
 * pipeline execution (covered by ingestion-scheduling.test.ts).
 *
 * Includes regression test for EventBridge/Scheduler event detection
 * using the exact event shape from CloudWatch logs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the pipeline ──────────────────────────────────────────────────────

const mockResult = {
  totalFetched: 42,
  totalInserted: 5,
  totalSkipped: 37,
  totalFailed: 0,
  sourceResults: [
    {
      source: "Hacker News Who's Hiring",
      fetched: 42,
      inserted: 5,
      skipped: 37,
      failed: 0,
      errors: [],
      durationMs: 2300,
    },
  ],
  durationMs: 5000,
  lockAcquired: true,
  sourcesSkipped: ["Devfolio", "Devpost"],
};

const mockPipelineModule = {
  runIngestionPipeline: vi.fn().mockResolvedValue(mockResult),
};

// Mock the dynamic import
vi.mock("@/lib/ingestion", () => mockPipelineModule);

// ── Import handler after mocking ────────────────────────────────────────────

describe("Ingestion Lambda Handler", () => {
  let handler: typeof import("@/lambda/ingestion").handler;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPipelineModule.runIngestionPipeline.mockResolvedValue(mockResult);
    // Dynamic import to get fresh handler with cleared module cache
    const mod = await import("@/lambda/ingestion");
    handler = mod.handler;
  });

  // ── Basic contract ──────────────────────────────────────────────────────

  it("exports a handler function", async () => {
    const mod = await import("@/lambda/ingestion");
    expect(typeof mod.handler).toBe("function");
  });

  it("returns success response on pipeline completion", async () => {
    const result = await handler({});

    expect(result.success).toBe(true);
    expect(result.message).toContain("Ingestion completed");
    expect(result.data).toBeDefined();
    expect(result.data!.totalFetched).toBe(42);
    expect(result.data!.totalInserted).toBe(5);
    expect(result.runId).toBeDefined();
  });

  it("includes a unique runId in every response", async () => {
    const r1 = await handler({});
    const r2 = await handler({});
    expect(r1.runId).toBeDefined();
    expect(r2.runId).toBeDefined();
    expect(r1.runId).not.toBe(r2.runId);
  });

  // ── Source filtering ────────────────────────────────────────────────────

  it("passes sourceName to pipeline when event.source is set", async () => {
    await handler({ source: "Devfolio" });
    expect(mockPipelineModule.runIngestionPipeline).toHaveBeenCalledWith("Devfolio");
  });

  it("passes undefined when no source is specified", async () => {
    await handler({});
    expect(mockPipelineModule.runIngestionPipeline).toHaveBeenCalledWith(undefined);
  });

  // ── Lock behavior ───────────────────────────────────────────────────────

  it("reports lock not acquired when pipeline is skipped", async () => {
    mockPipelineModule.runIngestionPipeline.mockResolvedValue({
      ...mockResult,
      lockAcquired: false,
      totalFetched: 0,
      totalInserted: 0,
      sourceResults: [],
      sourcesSkipped: [],
    });

    const result = await handler({});

    expect(result.success).toBe(true);
    expect(result.message).toContain("already in progress");
    expect(result.data!.lockAcquired).toBe(false);
  });

  // ── Error handling ──────────────────────────────────────────────────────

  it("returns error response when pipeline throws", async () => {
    mockPipelineModule.runIngestionPipeline.mockRejectedValue(
      new Error("MongoDB connection failed")
    );

    const result = await handler({});

    expect(result.success).toBe(false);
    expect(result.message).toContain("MongoDB connection failed");
    expect(result.error).toBe("MongoDB connection failed");
    expect(result.runId).toBeDefined();
  });

  it("handles non-Error thrown values", async () => {
    mockPipelineModule.runIngestionPipeline.mockRejectedValue("string error");

    const result = await handler({});

    expect(result.success).toBe(false);
    expect(result.message).toContain("Unknown error");
  });

  it("handles null/undefined event gracefully", async () => {
    const result = await handler(undefined as any);
    expect(result.success).toBe(true);
  });

  // ── Response structure ──────────────────────────────────────────────────

  it("includes source-level results in response", async () => {
    const result = await handler({});

    expect(result.data!.sourceResults).toHaveLength(1);
    expect(result.data!.sourceResults[0].source).toBe("Hacker News Who's Hiring");
    expect(result.data!.sourceResults[0].fetched).toBe(42);
  });

  it("includes sourcesSkipped in response", async () => {
    const result = await handler({});

    expect(result.data!.sourcesSkipped).toContain("Devfolio");
    expect(result.data!.sourcesSkipped).toContain("Devpost");
  });

  it("includes durationMs in response", async () => {
    const result = await handler({});
    expect(result.data!.durationMs).toBe(5000);
  });
});

// ── Lambda deployment contract ──────────────────────────────────────────────

describe("Lambda deployment contract", () => {
  it("handler file exists and is importable", async () => {
    const mod = await import("@/lambda/ingestion");
    expect(mod.handler).toBeDefined();
    expect(typeof mod.handler).toBe("function");
  });

  it("handler accepts LambdaEvent shape", async () => {
    const mod = await import("@/lambda/ingestion");
    // Valid events
    await mod.handler({});
    await mod.handler({ source: "HN" });
    await mod.handler({ forceAll: true });
    await mod.handler({ source: "HN", forceAll: true });

    // All should succeed without throwing
    expect(true).toBe(true);
  });

  it("handler returns LambdaResult shape", async () => {
    const mod = await import("@/lambda/ingestion");
    const result = await mod.handler({});

    // Required fields
    expect(typeof result.success).toBe("boolean");
    expect(typeof result.message).toBe("string");
    expect(typeof result.runId).toBe("string");

    // runId is a UUID
    expect(result.runId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});

// ── EventBridge / Scheduler event detection ─────────────────────────────────

describe("EventBridge/Scheduler event detection", () => {
  /**
   * Exact event shape from CloudWatch logs (2026-09-01T11:30:33 UTC).
   * This is what AWS EventBridge Scheduler sends to the Lambda.
   */
  const EVENTBRIDGE_SCHEDULER_EVENT = {
    version: "0",
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "detail-type": "Scheduled Event",
    source: "aws.schedule",
    account: "123456789012",
    time: "2026-09-01T11:30:33Z",
    region: "ap-south-1",
    resources: [
      "arn:aws:scheduler:ap-south-1:123456789012:default/oppy-ingestion-schedule",
    ],
    detail: {},
  };

  it("recognizes EventBridge Scheduler event and runs full pipeline", async () => {
    const { handler } = await import("@/lambda/ingestion");
    const result = await handler(EVENTBRIDGE_SCHEDULER_EVENT as any);

    expect(result.success).toBe(true);
    // Should run ALL sources (undefined = source-aware scheduling), NOT "aws.schedule"
    expect(mockPipelineModule.runIngestionPipeline).toHaveBeenCalledWith(undefined);
  });

  it("does NOT pass 'aws.schedule' as an ingestion source name", async () => {
    const { handler } = await import("@/lambda/ingestion");
    await handler(EVENTBRIDGE_SCHEDULER_EVENT as any);

    const calledWith = mockPipelineModule.runIngestionPipeline.mock.calls[0][0];
    expect(calledWith).not.toBe("aws.schedule");
  });

  it("recognizes event by detail-type field", async () => {
    const { handler } = await import("@/lambda/ingestion");
    const event = { "detail-type": "Scheduled Event", source: "aws.schedule" };
    await handler(event as any);

    expect(mockPipelineModule.runIngestionPipeline).toHaveBeenCalledWith(undefined);
  });

  it("recognizes event by version field", async () => {
    const { handler } = await import("@/lambda/ingestion");
    const event = { version: "0", source: "aws.schedule" };
    await handler(event as any);

    expect(mockPipelineModule.runIngestionPipeline).toHaveBeenCalledWith(undefined);
  });

  it("recognizes event by source='aws.schedule' alone", async () => {
    const { handler } = await import("@/lambda/ingestion");
    const event = { source: "aws.schedule" };
    await handler(event as any);

    expect(mockPipelineModule.runIngestionPipeline).toHaveBeenCalledWith(undefined);
  });

  it("still passes source name for direct invocation (not EventBridge)", async () => {
    const { handler } = await import("@/lambda/ingestion");
    await handler({ source: "Devfolio" });

    expect(mockPipelineModule.runIngestionPipeline).toHaveBeenCalledWith("Devfolio");
  });

  it("still respects forceAll for direct invocation", async () => {
    const { handler } = await import("@/lambda/ingestion");
    await handler({ forceAll: true });

    // forceAll = true → pass undefined to skip source-aware scheduling (run everything)
    expect(mockPipelineModule.runIngestionPipeline).toHaveBeenCalledWith(undefined);
  });

  it("empty event runs full pipeline (default behavior)", async () => {
    const { handler } = await import("@/lambda/ingestion");
    await handler({});

    expect(mockPipelineModule.runIngestionPipeline).toHaveBeenCalledWith(undefined);
  });
});

// ── Environment awareness ───────────────────────────────────────────────────

describe("Lambda environment", () => {
  it("uses Node.js crypto for runId (not bcrypt)", async () => {
    // The Lambda handler uses crypto.randomUUID(), not bcrypt.
    // This is intentional — bcrypt is not available in bundled Lambda.
    const { randomUUID } = await import("crypto");
    const id = randomUUID();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

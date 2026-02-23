import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CronJob } from "./types.js";
import { CronService } from "./service.js";

const noopLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

async function makeStorePath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-cron-"));
  return {
    storePath: path.join(dir, "cron", "jobs.json"),
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

async function waitForJob(
  cron: CronService,
  id: string,
  predicate: (job: CronJob | undefined) => boolean,
) {
  let latest: CronJob | undefined;
  for (let i = 0; i < 50; i++) {
    const jobs = await cron.list({ includeDisabled: true });
    latest = jobs.find((job) => job.id === id);
    if (predicate(latest)) {
      return latest;
    }
    await vi.runOnlyPendingTimersAsync();
  }
  return latest;
}

describe("CronService concurrent isolated jobs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-13T00:00:00.000Z"));
    noopLogger.debug.mockClear();
    noopLogger.info.mockClear();
    noopLogger.warn.mockClear();
    noopLogger.error.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("executes all due isolated jobs concurrently, not sequentially", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();

    // Track the overlap of job executions to prove concurrency
    const activeJobs = new Set<string>();
    let maxConcurrent = 0;
    const executionOrder: Array<{ id: string; event: "start" | "end" }> = [];

    const runIsolatedAgentJob = vi.fn(async ({ job }: { job: CronJob; message: string }) => {
      activeJobs.add(job.id);
      executionOrder.push({ id: job.id, event: "start" });
      maxConcurrent = Math.max(maxConcurrent, activeJobs.size);
      // Simulate async work — yield to allow other concurrent jobs to start
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      activeJobs.delete(job.id);
      executionOrder.push({ id: job.id, event: "end" });
      return { status: "ok" as const, summary: `done-${job.id}` };
    });

    const baseTime = Date.parse("2025-12-13T00:00:00.000Z");
    const dueAt = baseTime + 10_000;

    await fs.mkdir(path.dirname(store.storePath), { recursive: true });
    await fs.writeFile(
      store.storePath,
      JSON.stringify(
        {
          version: 1,
          jobs: [
            {
              id: "iso-job-1",
              name: "isolated job 1",
              enabled: true,
              createdAtMs: baseTime - 60_000,
              updatedAtMs: baseTime - 60_000,
              schedule: { kind: "every", everyMs: 60_000, anchorMs: baseTime - 60_000 },
              sessionTarget: "isolated",
              wakeMode: "next-heartbeat",
              payload: { kind: "agentTurn", message: "do task 1" },
              delivery: { mode: "announce" },
              state: { nextRunAtMs: dueAt },
            },
            {
              id: "iso-job-2",
              name: "isolated job 2",
              enabled: true,
              createdAtMs: baseTime - 60_000,
              updatedAtMs: baseTime - 60_000,
              schedule: { kind: "every", everyMs: 60_000, anchorMs: baseTime - 60_000 },
              sessionTarget: "isolated",
              wakeMode: "next-heartbeat",
              payload: { kind: "agentTurn", message: "do task 2" },
              delivery: { mode: "announce" },
              state: { nextRunAtMs: dueAt },
            },
            {
              id: "iso-job-3",
              name: "isolated job 3",
              enabled: true,
              createdAtMs: baseTime - 60_000,
              updatedAtMs: baseTime - 60_000,
              schedule: { kind: "every", everyMs: 60_000, anchorMs: baseTime - 60_000 },
              sessionTarget: "isolated",
              wakeMode: "next-heartbeat",
              payload: { kind: "agentTurn", message: "do task 3" },
              delivery: { mode: "announce" },
              state: { nextRunAtMs: dueAt },
            },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob,
    });

    await cron.start();
    expect(runIsolatedAgentJob).toHaveBeenCalledTimes(0);

    // Advance time past when all 3 jobs are due
    vi.setSystemTime(new Date(dueAt + 5));
    await vi.advanceTimersByTimeAsync(10_005);

    // Wait for all jobs to complete
    for (const jobId of ["iso-job-1", "iso-job-2", "iso-job-3"]) {
      await waitForJob(cron, jobId, (j) => j?.state.lastStatus === "ok");
    }

    // All 3 isolated jobs should have been executed exactly once
    expect(runIsolatedAgentJob).toHaveBeenCalledTimes(3);

    // The key assertion: isolated jobs should have run concurrently.
    // With sequential execution, maxConcurrent would be 1.
    // With concurrent execution, maxConcurrent should be 3 (all started before any finished).
    expect(maxConcurrent).toBe(3);

    // Verify interleaved execution order: all starts before all ends
    const starts = executionOrder.filter((e) => e.event === "start");
    const ends = executionOrder.filter((e) => e.event === "end");
    expect(starts).toHaveLength(3);
    expect(ends).toHaveLength(3);
    // All starts should come before any end in a concurrent execution
    const lastStartIdx = executionOrder.findLastIndex((e) => e.event === "start");
    const firstEndIdx = executionOrder.findIndex((e) => e.event === "end");
    expect(lastStartIdx).toBeLessThan(firstEndIdx);

    // Verify each job's final state
    const jobs = await cron.list({ includeDisabled: true });
    for (const jobId of ["iso-job-1", "iso-job-2", "iso-job-3"]) {
      const job = jobs.find((j) => j.id === jobId);
      expect(job?.state.lastStatus).toBe("ok");
      expect(job?.state.runningAtMs).toBeUndefined();
      expect(job?.state.nextRunAtMs).toBeGreaterThan(dueAt);
    }

    cron.stop();
    await store.cleanup();
  });
});

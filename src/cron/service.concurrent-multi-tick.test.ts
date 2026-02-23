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

describe("CronService concurrent multi-tick jobs", () => {
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

  it("all concurrent jobs get the same nextRunAtMs after each tick", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();

    const runIsolatedAgentJob = vi.fn(async ({ job }: { job: CronJob; message: string }) => {
      // Simulate async work
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      return { status: "ok" as const, summary: `done-${job.id}` };
    });

    const baseTime = Date.parse("2025-12-13T00:00:00.000Z");
    const firstDueAt = baseTime + 10_000;

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
              state: { nextRunAtMs: firstDueAt },
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
              state: { nextRunAtMs: firstDueAt },
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
              state: { nextRunAtMs: firstDueAt },
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

    // TICK 1: Advance time and wait for jobs to execute
    vi.setSystemTime(new Date(firstDueAt + 5));
    await vi.runOnlyPendingTimersAsync();

    // Wait for all 3 jobs to complete
    while (runIsolatedAgentJob.mock.calls.length < 3) {
      await vi.runOnlyPendingTimersAsync();
    }

    // All 3 jobs should have the SAME nextRunAtMs after tick 1
    let jobs = await cron.list({ includeDisabled: true });
    let nextRuns = jobs.map((j) => j.state.nextRunAtMs).toSorted();
    expect(nextRuns[0]).toBe(nextRuns[1]);
    expect(nextRuns[1]).toBe(nextRuns[2]);
    expect(nextRuns[0]).toBeGreaterThan(firstDueAt);
    const tick1NextRun = nextRuns[0] as number;

    // TICK 2: Advance past the next scheduled run
    vi.setSystemTime(new Date(tick1NextRun + 5));
    await vi.runOnlyPendingTimersAsync();

    // Wait for all 3 jobs to execute again
    while (runIsolatedAgentJob.mock.calls.length < 6) {
      await vi.runOnlyPendingTimersAsync();
    }

    // All 3 jobs should again have the SAME nextRunAtMs after tick 2
    jobs = await cron.list({ includeDisabled: true });
    nextRuns = jobs.map((j) => j.state.nextRunAtMs).toSorted();
    expect(nextRuns[0]).toBe(nextRuns[1]);
    expect(nextRuns[1]).toBe(nextRuns[2]);
    expect(nextRuns[0]).toBeGreaterThan(tick1NextRun);
    const tick2NextRun = nextRuns[0] as number;

    // TICK 3: Advance past the next scheduled run
    vi.setSystemTime(new Date(tick2NextRun + 5));
    await vi.runOnlyPendingTimersAsync();

    // Wait for all 3 jobs to execute again
    while (runIsolatedAgentJob.mock.calls.length < 9) {
      await vi.runOnlyPendingTimersAsync();
    }

    // All 3 jobs should again have the SAME nextRunAtMs after tick 3
    jobs = await cron.list({ includeDisabled: true });
    nextRuns = jobs.map((j) => j.state.nextRunAtMs).toSorted();
    expect(nextRuns[0]).toBe(nextRuns[1]);
    expect(nextRuns[1]).toBe(nextRuns[2]);
    expect(nextRuns[0]).toBeGreaterThan(tick2NextRun);

    // Verify all 9 executions happened
    expect(runIsolatedAgentJob).toHaveBeenCalledTimes(9);

    cron.stop();
    await store.cleanup();
  });
});

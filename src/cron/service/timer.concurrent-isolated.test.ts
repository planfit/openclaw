import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CronJob } from "../types.js";
import type { CronServiceState } from "./state.js";
import { findDueJobs } from "./timer.js";

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

describe("timer: concurrent isolated jobs with same everyMs but different anchorMs", () => {
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

  it("finds all jobs due when anchorMs differs by 6s and 15s within same everyMs=300000", async () => {
    const store = await makeStorePath();
    const baseTime = Date.parse("2025-12-13T00:00:00.000Z");
    const everyMs = 300_000; // 5 minutes

    // Three jobs with same everyMs but registered at different times
    // job1: anchor at baseTime
    // job2: anchor at baseTime + 6_000 (6s later)
    // job3: anchor at baseTime + 15_000 (15s later)
    const job1Anchor = baseTime;
    const job2Anchor = baseTime + 6_000;
    const job3Anchor = baseTime + 15_000;

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
              createdAtMs: job1Anchor,
              updatedAtMs: job1Anchor,
              schedule: { kind: "every", everyMs, anchorMs: job1Anchor },
              sessionTarget: "isolated",
              wakeMode: "next-heartbeat",
              payload: { kind: "agentTurn", message: "task 1" },
              delivery: { mode: "announce" },
              state: { nextRunAtMs: job1Anchor + everyMs },
            },
            {
              id: "iso-job-2",
              name: "isolated job 2",
              enabled: true,
              createdAtMs: job2Anchor,
              updatedAtMs: job2Anchor,
              schedule: { kind: "every", everyMs, anchorMs: job2Anchor },
              sessionTarget: "isolated",
              wakeMode: "next-heartbeat",
              payload: { kind: "agentTurn", message: "task 2" },
              delivery: { mode: "announce" },
              state: { nextRunAtMs: job2Anchor + everyMs },
            },
            {
              id: "iso-job-3",
              name: "isolated job 3",
              enabled: true,
              createdAtMs: job3Anchor,
              updatedAtMs: job3Anchor,
              schedule: { kind: "every", everyMs, anchorMs: job3Anchor },
              sessionTarget: "isolated",
              wakeMode: "next-heartbeat",
              payload: { kind: "agentTurn", message: "task 3" },
              delivery: { mode: "announce" },
              state: { nextRunAtMs: job3Anchor + everyMs },
            },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );

    // Read the store to get the jobs
    const storeContent = await fs.readFile(store.storePath, "utf-8");
    const storeData = JSON.parse(storeContent);

    // Create a minimal state with jobs
    const state: CronServiceState = {
      deps: {
        cronEnabled: true,
        log: noopLogger,
        nowMs: () => job1Anchor + everyMs + 5, // 5ms after first job is due
        enqueueSystemEvent: vi.fn(),
        requestHeartbeatNow: vi.fn(),
        runIsolatedAgentJob: vi.fn(),
        cronConfig: {},
      },
      store: {
        version: 1,
        jobs: storeData.jobs as CronJob[],
      },
      running: false,
      timer: null,
    };

    // Test findDueJobs at the time when the first job is due
    const dueJobs = findDueJobs(state);

    // All 3 jobs should be due because their nextRunAtMs values differ by only 6s and 15s
    // which is well within the tolerance we need (30s) for concurrent isolated jobs
    expect(dueJobs).toHaveLength(3);
    expect(dueJobs.map((j) => j.id).toSorted()).toEqual(["iso-job-1", "iso-job-2", "iso-job-3"]);

    // Verify the nextRunAtMs values
    const job1 = dueJobs.find((j) => j.id === "iso-job-1");
    const job2 = dueJobs.find((j) => j.id === "iso-job-2");
    const job3 = dueJobs.find((j) => j.id === "iso-job-3");

    expect(job1?.state.nextRunAtMs).toBe(job1Anchor + everyMs);
    expect(job2?.state.nextRunAtMs).toBe(job2Anchor + everyMs);
    expect(job3?.state.nextRunAtMs).toBe(job3Anchor + everyMs);

    // The difference between the earliest and latest nextRunAtMs should be 15s
    const nextRunTimes = [
      job1!.state.nextRunAtMs!,
      job2!.state.nextRunAtMs!,
      job3!.state.nextRunAtMs!,
    ];
    const minTime = Math.min(...nextRunTimes);
    const maxTime = Math.max(...nextRunTimes);
    expect(maxTime - minTime).toBe(15_000);

    await store.cleanup();
  });
});

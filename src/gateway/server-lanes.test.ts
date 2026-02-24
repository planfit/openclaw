import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { loadConfig } from "../config/config.js";
import { CommandLane } from "../process/lanes.js";
import { applyGatewayLaneConcurrency } from "./server-lanes.js";

// Mock the command-queue module
vi.mock("../process/command-queue.js", () => ({
  setCommandLaneConcurrency: vi.fn(),
}));

// Mock the agent-limits module
vi.mock("../config/agent-limits.js", () => ({
  resolveAgentMaxConcurrent: vi.fn(() => 5),
  resolveSubagentMaxConcurrent: vi.fn(() => 3),
}));

describe("applyGatewayLaneConcurrency", () => {
  let setCommandLaneConcurrency: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    const commandQueue = await import("../process/command-queue.js");
    setCommandLaneConcurrency = commandQueue.setCommandLaneConcurrency as ReturnType<typeof vi.fn>;
    setCommandLaneConcurrency.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("applies default cron concurrency of 10 when unset", () => {
    const cfg = {} as ReturnType<typeof loadConfig>;
    applyGatewayLaneConcurrency(cfg);

    expect(setCommandLaneConcurrency).toHaveBeenCalledWith(CommandLane.Cron, 10);
  });

  it("applies configured cron concurrency when set", () => {
    const cfg = {
      cron: {
        maxConcurrentRuns: 5,
      },
    } as ReturnType<typeof loadConfig>;
    applyGatewayLaneConcurrency(cfg);

    expect(setCommandLaneConcurrency).toHaveBeenCalledWith(CommandLane.Cron, 5);
  });

  it("applies 0 cron concurrency when explicitly set to 0", () => {
    const cfg = {
      cron: {
        maxConcurrentRuns: 0,
      },
    } as ReturnType<typeof loadConfig>;
    applyGatewayLaneConcurrency(cfg);

    expect(setCommandLaneConcurrency).toHaveBeenCalledWith(CommandLane.Cron, 0);
  });

  it("applies all lane concurrency settings", () => {
    const cfg = {
      cron: {
        maxConcurrentRuns: 15,
      },
    } as ReturnType<typeof loadConfig>;
    applyGatewayLaneConcurrency(cfg);

    expect(setCommandLaneConcurrency).toHaveBeenCalledTimes(3);
    expect(setCommandLaneConcurrency).toHaveBeenCalledWith(CommandLane.Cron, 15);
    expect(setCommandLaneConcurrency).toHaveBeenCalledWith(CommandLane.Main, 5);
    expect(setCommandLaneConcurrency).toHaveBeenCalledWith(CommandLane.Subagent, 3);
  });
});

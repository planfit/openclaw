import { beforeEach, describe, expect, it, vi } from "vitest";
import { sleep } from "../utils.js";
import { runClaudeCliAgent } from "./claude-cli-runner.js";

const runCommandWithTimeoutMock = vi.fn();
const runSDKAgentMock = vi.fn();

function createDeferred<T>() {
  let resolve: (value: T) => void;
  let reject: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve: resolve as (value: T) => void,
    reject: reject as (error: unknown) => void,
  };
}

async function waitForCalls(mockFn: { mock: { calls: unknown[][] } }, count: number) {
  for (let i = 0; i < 50; i += 1) {
    if (mockFn.mock.calls.length >= count) {
      return;
    }
    await sleep(0);
  }
  throw new Error(`Expected ${count} calls, got ${mockFn.mock.calls.length}`);
}

vi.mock("../process/exec.js", () => ({
  runCommandWithTimeout: (...args: unknown[]) => runCommandWithTimeoutMock(...args),
}));

vi.mock("./claude-sdk-integration.js", () => ({
  runSDKAgent: (...args: unknown[]) => runSDKAgentMock(...args),
}));

describe("runClaudeCliAgent", () => {
  beforeEach(() => {
    runCommandWithTimeoutMock.mockReset();
    runSDKAgentMock.mockReset();
  });

  it("starts a new session via SDK when none is provided", async () => {
    runSDKAgentMock.mockResolvedValueOnce({
      text: "ok",
      sessionId: "sid-1",
      durationMs: 100,
      numTurns: 1,
      totalCostUsd: 0.01,
    });

    await runClaudeCliAgent({
      sessionId: "openclaw-session",
      sessionFile: "/tmp/session.jsonl",
      workspaceDir: "/tmp",
      prompt: "hi",
      model: "opus",
      timeoutMs: 1_000,
      runId: "run-1",
    });

    expect(runSDKAgentMock).toHaveBeenCalledTimes(1);
    expect(runCommandWithTimeoutMock).not.toHaveBeenCalled();

    const sdkParams = runSDKAgentMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sdkParams.prompt).toBe("hi");
    expect(sdkParams.cwd).toBe("/tmp");
  });

  it("uses resume when a claude session id is provided", async () => {
    runSDKAgentMock.mockResolvedValueOnce({
      text: "ok",
      sessionId: "c9d7b831-1c31-4d22-80b9-1e50ca207d4b",
      durationMs: 100,
      numTurns: 1,
      totalCostUsd: 0.01,
    });

    await runClaudeCliAgent({
      sessionId: "openclaw-session",
      sessionFile: "/tmp/session.jsonl",
      workspaceDir: "/tmp",
      prompt: "hi",
      model: "opus",
      timeoutMs: 1_000,
      runId: "run-2",
      claudeSessionId: "c9d7b831-1c31-4d22-80b9-1e50ca207d4b",
    });

    expect(runSDKAgentMock).toHaveBeenCalledTimes(1);
    const sdkParams = runSDKAgentMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sdkParams.resume).toBe("c9d7b831-1c31-4d22-80b9-1e50ca207d4b");
  });

  it("serializes concurrent claude-cli runs", async () => {
    const firstDeferred = createDeferred<{
      text: string;
      sessionId: string;
      durationMs: number;
      numTurns: number;
      totalCostUsd: number;
    }>();
    const secondDeferred = createDeferred<{
      text: string;
      sessionId: string;
      durationMs: number;
      numTurns: number;
      totalCostUsd: number;
    }>();

    runSDKAgentMock
      .mockImplementationOnce(() => firstDeferred.promise)
      .mockImplementationOnce(() => secondDeferred.promise);

    const firstRun = runClaudeCliAgent({
      sessionId: "s1",
      sessionFile: "/tmp/session.jsonl",
      workspaceDir: "/tmp",
      prompt: "first",
      model: "opus",
      timeoutMs: 1_000,
      runId: "run-1",
    });

    const secondRun = runClaudeCliAgent({
      sessionId: "s2",
      sessionFile: "/tmp/session.jsonl",
      workspaceDir: "/tmp",
      prompt: "second",
      model: "opus",
      timeoutMs: 1_000,
      runId: "run-2",
    });

    await waitForCalls(runSDKAgentMock, 1);

    firstDeferred.resolve({
      text: "ok",
      sessionId: "sid-1",
      durationMs: 100,
      numTurns: 1,
      totalCostUsd: 0.01,
    });

    await waitForCalls(runSDKAgentMock, 2);

    secondDeferred.resolve({
      text: "ok",
      sessionId: "sid-2",
      durationMs: 100,
      numTurns: 1,
      totalCostUsd: 0.01,
    });

    await Promise.all([firstRun, secondRun]);
  });
});

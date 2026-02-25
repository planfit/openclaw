import { beforeEach, describe, expect, it, vi } from "vitest";

const callGatewayMock = vi.fn();
vi.mock("../../gateway/call.js", () => ({
  callGateway: (opts: unknown) => callGatewayMock(opts),
}));

vi.mock("../../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../config/config.js")>();
  return {
    ...actual,
    loadConfig: () =>
      ({
        session: { scope: "per-sender", mainKey: "main" },
        tools: { agentToAgent: { enabled: true } },
      }) as never,
  };
});

const getSubagentRunBySessionKeyMock = vi.fn();
vi.mock("../subagent-registry.js", () => ({
  getSubagentRunBySessionKey: (...args: unknown[]) => getSubagentRunBySessionKeyMock(...args),
}));

import { createSessionsListTool } from "./sessions-list-tool.js";

describe("sessions_list runStatus enrichment", () => {
  beforeEach(() => {
    callGatewayMock.mockReset();
    getSubagentRunBySessionKeyMock.mockReset();
    callGatewayMock.mockResolvedValue({
      path: "/tmp/sessions.json",
      sessions: [{ key: "agent:main:subagent:abc123", kind: "direct", label: "worker-1" }],
    });
  });

  it("returns runStatus running when subagent run is active (in-memory)", async () => {
    getSubagentRunBySessionKeyMock.mockReturnValue({
      runId: "run-1",
      childSessionKey: "agent:main:subagent:abc123",
      requesterSessionKey: "agent:main:main",
      task: "do stuff",
      cleanup: "keep",
      createdAt: 1000,
      startedAt: 2000,
      // no endedAt → running
    });

    const tool = createSessionsListTool({ agentSessionKey: "agent:main:main" });
    const result = await tool.execute("call1", {});
    const sessions = (result.details as { sessions: Array<Record<string, unknown>> }).sessions;
    expect(sessions[0].runStatus).toBe("running");
    expect(sessions[0].elapsedMs).toBeTypeOf("number");
  });

  it("returns runStatus completed when subagent run has ended (in-memory)", async () => {
    getSubagentRunBySessionKeyMock.mockReturnValue({
      runId: "run-1",
      childSessionKey: "agent:main:subagent:abc123",
      requesterSessionKey: "agent:main:main",
      task: "do stuff",
      cleanup: "keep",
      createdAt: 1000,
      startedAt: 2000,
      endedAt: 3000,
      outcome: { status: "ok" },
    });

    const tool = createSessionsListTool({ agentSessionKey: "agent:main:main" });
    const result = await tool.execute("call1", {});
    const sessions = (result.details as { sessions: Array<Record<string, unknown>> }).sessions;
    expect(sessions[0].runStatus).toBe("completed");
  });

  it("returns runStatus error when subagent run ended with error", async () => {
    getSubagentRunBySessionKeyMock.mockReturnValue({
      runId: "run-1",
      childSessionKey: "agent:main:subagent:abc123",
      requesterSessionKey: "agent:main:main",
      task: "do stuff",
      cleanup: "keep",
      createdAt: 1000,
      startedAt: 2000,
      endedAt: 3000,
      outcome: { status: "error", error: "something failed" },
    });

    const tool = createSessionsListTool({ agentSessionKey: "agent:main:main" });
    const result = await tool.execute("call1", {});
    const sessions = (result.details as { sessions: Array<Record<string, unknown>> }).sessions;
    expect(sessions[0].runStatus).toBe("error");
  });

  it("omits runStatus when no run record found", async () => {
    getSubagentRunBySessionKeyMock.mockReturnValue(undefined);

    const tool = createSessionsListTool({ agentSessionKey: "agent:main:main" });
    const result = await tool.execute("call1", {});
    const sessions = (result.details as { sessions: Array<Record<string, unknown>> }).sessions;
    expect(sessions[0].runStatus).toBeUndefined();
  });
});

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
  registerSubagentRun: vi.fn(),
}));

import { createSessionsSendTool } from "./sessions-send-tool.js";

describe("sessions_send timeout includes session status", () => {
  const baseMockSetup = () => {
    // sessions.list for resolution
    callGatewayMock.mockImplementation((opts: { method: string }) => {
      if (opts.method === "sessions.list") {
        return {
          path: "/tmp/sessions.json",
          sessions: [{ key: "agent:main:subagent:abc123", kind: "direct", label: "worker-1" }],
        };
      }
      if (opts.method === "sessions.resolve") {
        return { key: "agent:main:subagent:abc123" };
      }
      if (opts.method === "agent") {
        return { runId: "run-1" };
      }
      if (opts.method === "agent.wait") {
        return { status: "timeout" };
      }
      return {};
    });
  };

  beforeEach(() => {
    callGatewayMock.mockReset();
    getSubagentRunBySessionKeyMock.mockReset();
  });

  it("includes sessionRunning:true on timeout when run is active", async () => {
    baseMockSetup();
    getSubagentRunBySessionKeyMock.mockReturnValue({
      runId: "run-1",
      childSessionKey: "agent:main:subagent:abc123",
      startedAt: 2000,
      // no endedAt → running
    });

    const tool = createSessionsSendTool({ agentSessionKey: "agent:main:main" });
    const result = await tool.execute("call1", {
      label: "worker-1",
      message: "hello",
      timeoutSeconds: 5,
    });
    const details = result.details as Record<string, unknown>;
    expect(details.status).toBe("timeout");
    expect(details.sessionRunning).toBe(true);
  });

  it("includes sessionRunning:false on timeout when run has ended", async () => {
    baseMockSetup();
    getSubagentRunBySessionKeyMock.mockReturnValue({
      runId: "run-1",
      childSessionKey: "agent:main:subagent:abc123",
      startedAt: 2000,
      endedAt: 3000,
      outcome: { status: "ok" },
    });

    const tool = createSessionsSendTool({ agentSessionKey: "agent:main:main" });
    const result = await tool.execute("call1", {
      label: "worker-1",
      message: "hello",
      timeoutSeconds: 5,
    });
    const details = result.details as Record<string, unknown>;
    expect(details.status).toBe("timeout");
    expect(details.sessionRunning).toBe(false);
  });

  it("omits sessionRunning on timeout when no run record found", async () => {
    baseMockSetup();
    getSubagentRunBySessionKeyMock.mockReturnValue(undefined);

    const tool = createSessionsSendTool({ agentSessionKey: "agent:main:main" });
    const result = await tool.execute("call1", {
      label: "worker-1",
      message: "hello",
      timeoutSeconds: 5,
    });
    const details = result.details as Record<string, unknown>;
    expect(details.status).toBe("timeout");
    expect(details.sessionRunning).toBeUndefined();
  });
});

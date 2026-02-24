import { beforeEach, describe, expect, it, vi } from "vitest";

const agentSpy = vi.fn(async () => ({ runId: "run-main", status: "ok" }));
const readLatestAssistantReplyMock = vi.fn(async () => "test reply");
const embeddedRunMock = {
  isEmbeddedPiRunActive: vi.fn(() => false),
  isEmbeddedPiRunStreaming: vi.fn(() => false),
  queueEmbeddedPiMessage: vi.fn(() => false),
  waitForEmbeddedPiRunEnd: vi.fn(async () => true),
};
let sessionStore: Record<string, Record<string, unknown>> = {};
let configOverride: ReturnType<(typeof import("../config/config.js"))["loadConfig"]> = {
  session: {
    mainKey: "main",
    scope: "per-sender",
  },
};

vi.mock("../gateway/call.js", () => ({
  callGateway: vi.fn(async (req: unknown) => {
    const typed = req as { method?: string; params?: Record<string, unknown> };
    if (typed.method === "agent") {
      return await agentSpy(typed);
    }
    if (typed.method === "agent.wait") {
      return { status: "ok", startedAt: 10, endedAt: 20 };
    }
    if (typed.method === "sessions.patch") {
      return {};
    }
    if (typed.method === "sessions.delete") {
      return {};
    }
    return {};
  }),
}));

vi.mock("./tools/agent-step.js", () => ({
  readLatestAssistantReply: readLatestAssistantReplyMock,
}));

vi.mock("../config/sessions.js", () => ({
  loadSessionStore: vi.fn(() => sessionStore),
  resolveAgentIdFromSessionKey: () => "main",
  resolveStorePath: () => "/tmp/sessions.json",
  resolveMainSessionKey: () => "agent:main:main",
  readSessionUpdatedAt: vi.fn(() => undefined),
  recordSessionMetaFromInbound: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./pi-embedded.js", () => embeddedRunMock);

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig: () => configOverride,
  };
});

describe("subagent-announce threadId omission", () => {
  beforeEach(() => {
    agentSpy.mockClear();
    embeddedRunMock.isEmbeddedPiRunActive.mockReset().mockReturnValue(false);
    embeddedRunMock.isEmbeddedPiRunStreaming.mockReset().mockReturnValue(false);
    embeddedRunMock.queueEmbeddedPiMessage.mockReset().mockReturnValue(false);
    embeddedRunMock.waitForEmbeddedPiRunEnd.mockReset().mockResolvedValue(true);
    readLatestAssistantReplyMock.mockReset().mockResolvedValue("test reply");
    sessionStore = {};
    configOverride = {
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
    };
  });

  it("omits threadId key entirely when directOrigin.threadId is undefined (should allow gateway to use session default)", async () => {
    const { runSubagentAnnounceFlow } = await import("./subagent-announce.js");

    // Session has a lastThreadId that should be used by the gateway
    sessionStore = {
      "agent:main:main": {
        sessionId: "session-123",
        lastChannel: "slack",
        lastTo: "C123",
        lastThreadId: "1234567890.123456",
      },
    };

    await runSubagentAnnounceFlow({
      childSessionKey: "agent:main:subagent:test",
      childRunId: "run-test",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      // requesterOrigin has NO threadId - should use session default
      requesterOrigin: {
        channel: "slack",
        to: "C123",
      },
      task: "test task",
      timeoutMs: 1000,
      cleanup: "keep",
      waitForCompletion: false,
      outcome: { status: "ok" },
    });

    expect(agentSpy).toHaveBeenCalled();
    const call = agentSpy.mock.calls[0]?.[0] as { params?: Record<string, unknown> };

    // BUG: Currently sends threadId: "" which gateway converts to null (explicit "no thread")
    // EXPECTED: threadId key should be OMITTED entirely so gateway uses session's lastThreadId
    expect(call?.params).not.toHaveProperty("threadId");
  });

  it("omits threadId when directOrigin.threadId is empty string (normalized to undefined)", async () => {
    const { runSubagentAnnounceFlow } = await import("./subagent-announce.js");

    sessionStore = {
      "agent:main:main": {
        sessionId: "session-456",
        lastChannel: "slack",
        lastTo: "C456",
        lastThreadId: "9999999999.999999",
      },
    };

    await runSubagentAnnounceFlow({
      childSessionKey: "agent:main:subagent:test",
      childRunId: "run-test-2",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      // requesterOrigin with empty string threadId gets normalized to undefined
      requesterOrigin: {
        channel: "slack",
        to: "C456",
        threadId: "",
      },
      task: "test task",
      timeoutMs: 1000,
      cleanup: "keep",
      waitForCompletion: false,
      outcome: { status: "ok" },
    });

    expect(agentSpy).toHaveBeenCalled();
    const call = agentSpy.mock.calls[0]?.[0] as { params?: Record<string, unknown> };

    // Empty string is normalized to undefined by normalizeDeliveryContext
    // So threadId key should be omitted (allows gateway to use session default)
    expect(call?.params).not.toHaveProperty("threadId");
  });

  it("sends explicit threadId when directOrigin.threadId is a non-empty value", async () => {
    const { runSubagentAnnounceFlow } = await import("./subagent-announce.js");

    sessionStore = {
      "agent:main:main": {
        sessionId: "session-789",
        lastChannel: "slack",
        lastTo: "C789",
        lastThreadId: "old-thread-id",
      },
    };

    await runSubagentAnnounceFlow({
      childSessionKey: "agent:main:subagent:test",
      childRunId: "run-test-3",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      // requesterOrigin has explicit threadId that should override session
      requesterOrigin: {
        channel: "slack",
        to: "C789",
        threadId: "new-thread-id",
      },
      task: "test task",
      timeoutMs: 1000,
      cleanup: "keep",
      waitForCompletion: false,
      outcome: { status: "ok" },
    });

    expect(agentSpy).toHaveBeenCalled();
    const call = agentSpy.mock.calls[0]?.[0] as { params?: Record<string, unknown> };

    expect(call?.params?.threadId).toBe("new-thread-id");
  });

  it("omits threadId when directOrigin is undefined and session has no threadId", async () => {
    const { runSubagentAnnounceFlow } = await import("./subagent-announce.js");

    sessionStore = {
      "agent:main:main": {
        sessionId: "session-no-thread",
        lastChannel: "slack",
        lastTo: "C999",
        // No lastThreadId
      },
    };

    await runSubagentAnnounceFlow({
      childSessionKey: "agent:main:subagent:test",
      childRunId: "run-test-4",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      // No requesterOrigin at all
      task: "test task",
      timeoutMs: 1000,
      cleanup: "keep",
      waitForCompletion: false,
      outcome: { status: "ok" },
    });

    expect(agentSpy).toHaveBeenCalled();
    const call = agentSpy.mock.calls[0]?.[0] as { params?: Record<string, unknown> };

    // No threadId anywhere, should omit the key
    expect(call?.params).not.toHaveProperty("threadId");
  });

  it("sends numeric threadId correctly", async () => {
    const { runSubagentAnnounceFlow } = await import("./subagent-announce.js");

    await runSubagentAnnounceFlow({
      childSessionKey: "agent:main:subagent:test",
      childRunId: "run-test-5",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      requesterOrigin: {
        channel: "telegram",
        to: "-1001234567890",
        threadId: 42,
      },
      task: "test task",
      timeoutMs: 1000,
      cleanup: "keep",
      waitForCompletion: false,
      outcome: { status: "ok" },
    });

    expect(agentSpy).toHaveBeenCalled();
    const call = agentSpy.mock.calls[0]?.[0] as { params?: Record<string, unknown> };

    expect(call?.params?.threadId).toBe("42");
  });

  it("sends zero threadId correctly", async () => {
    const { runSubagentAnnounceFlow } = await import("./subagent-announce.js");

    await runSubagentAnnounceFlow({
      childSessionKey: "agent:main:subagent:test",
      childRunId: "run-test-6",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      requesterOrigin: {
        channel: "telegram",
        to: "-1001234567890",
        threadId: 0,
      },
      task: "test task",
      timeoutMs: 1000,
      cleanup: "keep",
      waitForCompletion: false,
      outcome: { status: "ok" },
    });

    expect(agentSpy).toHaveBeenCalled();
    const call = agentSpy.mock.calls[0]?.[0] as { params?: Record<string, unknown> };

    // Zero is a valid threadId (e.g., Telegram supergroup general topic)
    expect(call?.params?.threadId).toBe("0");
  });
});

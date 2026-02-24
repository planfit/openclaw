import { afterEach, describe, expect, it, vi } from "vitest";
import type { CliDeps } from "../../cli/outbound-send-deps.js";
import type { OpenClawConfig } from "../../config/config.js";
import type { CronJob } from "../types.js";

const mocks = vi.hoisted(() => ({
  deliverOutboundPayloads: vi.fn(),
  runSubagentAnnounceFlow: vi.fn(),
  runEmbeddedPiAgent: vi.fn(),
  updateSessionStore: vi.fn(),
  loadSessionStore: vi.fn(() => ({})),
  ensureAgentWorkspace: vi.fn(async (opts: { dir: string }) => ({ dir: opts.dir })),
  loadModelCatalog: vi.fn(async () => []),
  buildWorkspaceSkillSnapshot: vi.fn(() => null),
  getSkillsSnapshotVersion: vi.fn(() => "v1"),
  createOutboundSendDeps: vi.fn((deps: unknown) => deps),
}));

vi.mock("../../infra/outbound/deliver.js", () => ({
  deliverOutboundPayloads: mocks.deliverOutboundPayloads,
}));

vi.mock("../../agents/subagent-announce.js", () => ({
  runSubagentAnnounceFlow: mocks.runSubagentAnnounceFlow,
}));

vi.mock("../../agents/pi-embedded.js", () => ({
  runEmbeddedPiAgent: mocks.runEmbeddedPiAgent,
}));

vi.mock("../../agents/workspace.js", async () => {
  const actual = await vi.importActual<typeof import("../../agents/workspace.js")>(
    "../../agents/workspace.js",
  );
  return {
    ...actual,
    ensureAgentWorkspace: mocks.ensureAgentWorkspace,
  };
});

vi.mock("../../config/sessions.js", async () => {
  const actual = await vi.importActual<typeof import("../../config/sessions.js")>(
    "../../config/sessions.js",
  );
  return {
    ...actual,
    updateSessionStore: mocks.updateSessionStore,
    loadSessionStore: mocks.loadSessionStore,
    resolveStorePath: vi.fn(() => "/tmp/test-store.json"),
    resolveSessionTranscriptPath: vi.fn(() => "/tmp/session.json"),
  };
});

vi.mock("../../agents/model-catalog.js", () => ({
  loadModelCatalog: mocks.loadModelCatalog,
}));

vi.mock("../../agents/skills.js", () => ({
  buildWorkspaceSkillSnapshot: mocks.buildWorkspaceSkillSnapshot,
}));

vi.mock("../../agents/skills/refresh.js", () => ({
  getSkillsSnapshotVersion: mocks.getSkillsSnapshotVersion,
}));

vi.mock("../../cli/outbound-send-deps.js", () => ({
  createOutboundSendDeps: mocks.createOutboundSendDeps,
}));

vi.mock("../../agents/model-fallback.js", () => ({
  runWithModelFallback: vi.fn(async ({ run }) => ({
    result: await run("anthropic", "claude-sonnet-4"),
    provider: "anthropic",
    model: "claude-sonnet-4",
  })),
}));

vi.mock("../../infra/agent-events.js", () => ({
  registerAgentRunContext: vi.fn(),
}));

import { runCronIsolatedAgentTurn } from "./run.js";

function makeCfg(overrides?: Partial<OpenClawConfig>): OpenClawConfig {
  return {
    bindings: [],
    channels: {},
    agents: {
      defaults: {},
    },
    ...overrides,
  } as OpenClawConfig;
}

function makeDeps(): CliDeps {
  return {} as CliDeps;
}

describe("cron announce with delivery.to", () => {
  afterEach(() => {
    vi.clearAllMocks();
    mocks.loadSessionStore.mockReturnValue({});
  });

  it("uses deliverOutboundPayloads directly when delivery.to is set (not runSubagentAnnounceFlow)", async () => {
    // Setup: Mock successful agent run with text output
    mocks.runEmbeddedPiAgent.mockResolvedValue({
      payloads: [{ text: "Task completed successfully" }],
      meta: { agentMeta: { provider: "anthropic", model: "claude-sonnet-4" } },
      didSendViaMessagingTool: false,
      messagingToolSentTargets: [],
    });

    // Mock successful delivery
    mocks.deliverOutboundPayloads.mockResolvedValue([
      { messageId: "msg-123", channel: "telegram" },
    ]);

    const cfg = makeCfg({
      bindings: [
        {
          agentId: "test-agent",
          match: { channel: "telegram", accountId: "test-account" },
        },
      ],
    });

    const job: CronJob = {
      id: "test-job-1",
      name: "test-announce",
      schedule: { kind: "every", everyMs: 60_000, anchorMs: Date.now() },
      sessionTarget: "isolated",
      wakeMode: "next-heartbeat",
      payload: {
        kind: "agentTurn",
        message: "Do the task",
      },
      delivery: {
        mode: "announce",
        channel: "telegram",
        to: "123456789",
      },
      createdAt: Date.now(),
      nextAt: Date.now(),
      enabled: true,
    };

    const result = await runCronIsolatedAgentTurn({
      cfg,
      deps: makeDeps(),
      job,
      message: "Do the task",
      sessionKey: "cron:test-job-1",
      agentId: "test-agent",
    });

    // Assert: Should use deliverOutboundPayloads directly
    expect(mocks.deliverOutboundPayloads).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "telegram",
        to: "123456789",
        payloads: [{ text: "Task completed successfully" }],
      }),
    );

    // Assert: Should NOT use runSubagentAnnounceFlow (the gateway agent call)
    expect(mocks.runSubagentAnnounceFlow).not.toHaveBeenCalled();

    expect(result.status).toBe("ok");
    expect(result.outputText).toBe("Task completed successfully");
  });

  it("still uses deliverOutboundPayloads for media content when delivery.to is set", async () => {
    // Setup: Mock agent run with media output
    mocks.runEmbeddedPiAgent.mockResolvedValue({
      payloads: [
        {
          text: "Here's the report",
          mediaUrl: "https://example.com/report.pdf",
        },
      ],
      meta: { agentMeta: { provider: "anthropic", model: "claude-sonnet-4" } },
      didSendViaMessagingTool: false,
      messagingToolSentTargets: [],
    });

    mocks.deliverOutboundPayloads.mockResolvedValue([
      { messageId: "msg-456", channel: "telegram" },
    ]);

    const cfg = makeCfg({
      bindings: [
        {
          agentId: "test-agent",
          match: { channel: "telegram", accountId: "test-account" },
        },
      ],
    });

    const job: CronJob = {
      id: "test-job-2",
      name: "test-media",
      schedule: { kind: "every", everyMs: 60_000, anchorMs: Date.now() },
      sessionTarget: "isolated",
      wakeMode: "next-heartbeat",
      payload: {
        kind: "agentTurn",
        message: "Generate report",
      },
      delivery: {
        mode: "announce",
        channel: "telegram",
        to: "987654321",
      },
      createdAt: Date.now(),
      nextAt: Date.now(),
      enabled: true,
    };

    const result = await runCronIsolatedAgentTurn({
      cfg,
      deps: makeDeps(),
      job,
      message: "Generate report",
      sessionKey: "cron:test-job-2",
      agentId: "test-agent",
    });

    // Assert: Should use deliverOutboundPayloads for media
    expect(mocks.deliverOutboundPayloads).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "telegram",
        to: "987654321",
        payloads: [
          {
            text: "Here's the report",
            mediaUrl: "https://example.com/report.pdf",
          },
        ],
      }),
    );

    // Assert: Should NOT use runSubagentAnnounceFlow
    expect(mocks.runSubagentAnnounceFlow).not.toHaveBeenCalled();

    expect(result.status).toBe("ok");
  });

  it("fallback: uses runSubagentAnnounceFlow when delivery.to is NOT set but session has lastTo (backward compat)", async () => {
    // Setup: Mock session store with lastTo so resolvedDelivery.to is populated
    mocks.loadSessionStore.mockReturnValue({
      "agent:main:main": {
        sessionId: "sess-fallback",
        updatedAt: Date.now(),
        lastChannel: "telegram",
        lastTo: "987654321",
        lastAccountId: "test-account",
      },
    });

    // Setup: Mock agent run
    mocks.runEmbeddedPiAgent.mockResolvedValue({
      payloads: [{ text: "Task done" }],
      meta: { agentMeta: { provider: "anthropic", model: "claude-sonnet-4" } },
      didSendViaMessagingTool: false,
      messagingToolSentTargets: [],
    });

    mocks.runSubagentAnnounceFlow.mockResolvedValue(true);

    const cfg = makeCfg();

    const job: CronJob = {
      id: "test-job-3",
      name: "test-fallback",
      schedule: { kind: "every", everyMs: 60_000, anchorMs: Date.now() },
      sessionTarget: "isolated",
      wakeMode: "next-heartbeat",
      payload: {
        kind: "agentTurn",
        message: "Do the task",
      },
      delivery: {
        mode: "announce",
        // No 'to' field - should resolve from session's lastTo and still work,
        // but since there's no explicit delivery.to, should use runSubagentAnnounceFlow
      },
      createdAt: Date.now(),
      nextAt: Date.now(),
      enabled: true,
    };

    const result = await runCronIsolatedAgentTurn({
      cfg,
      deps: makeDeps(),
      job,
      message: "Do the task",
      sessionKey: "cron:test-job-3",
    });

    // Assert: Should use runSubagentAnnounceFlow when no delivery.to
    expect(mocks.runSubagentAnnounceFlow).toHaveBeenCalled();

    // Assert: Should NOT use deliverOutboundPayloads
    expect(mocks.deliverOutboundPayloads).not.toHaveBeenCalled();

    expect(result.status).toBe("ok");

    // Reset mock for other tests
    mocks.loadSessionStore.mockReturnValue({});
  });
});

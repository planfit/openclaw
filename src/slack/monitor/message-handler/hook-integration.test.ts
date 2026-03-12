/**
 * Integration test for message:inbound hook triggered by message-handler
 */

import type { App } from "@slack/bolt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SlackMessageEvent } from "../../types.js";
import type { SlackMonitorContext } from "../context.js";
import { clearInternalHooks, registerInternalHook } from "../../../hooks/internal-hooks.js";
import { createSlackMessageHandler } from "../message-handler.js";

describe("message-handler hook integration", () => {
  beforeEach(() => {
    clearInternalHooks();
  });

  afterEach(() => {
    clearInternalHooks();
  });

  it("should trigger message:inbound hook when onFlush processes a message", async () => {
    const hookEvents: unknown[] = [];
    const handler = vi.fn((event) => {
      hookEvents.push(event);
    });

    registerInternalHook("message:inbound", handler);

    // Mock SlackMonitorContext
    const mockContext: Partial<SlackMonitorContext> = {
      accountId: "test-account",
      teamId: "T123",
      cfg: {} as unknown,
      channelsConfig: {},
      allowFrom: [],
      app: {
        client: {
          conversations: {
            info: vi.fn().mockResolvedValue({
              ok: true,
              channel: { name: "test-channel", is_channel: true },
            }),
          },
          users: {
            info: vi.fn().mockResolvedValue({
              ok: true,
              user: { name: "testuser", real_name: "Test User" },
            }),
          },
        } as unknown,
      } as App,
      botToken: "xoxb-test",
      botUserId: "U0BOTUSER",
      markMessageSeen: vi.fn().mockReturnValue(false),
      resolveChannelName: vi.fn().mockResolvedValue({ name: "test-channel", type: "channel" }),
      resolveUserName: vi.fn().mockResolvedValue({ name: "testuser" }),
      isChannelAllowed: vi.fn().mockReturnValue(true),
      dmEnabled: false,
      dmPolicy: "disabled",
      defaultRequireMention: false,
      threadInheritParent: false,
      threadHistoryScope: "channel" as const,
      historyLimit: 0,
      channelHistories: new Map(),
      mediaMaxBytes: 0,
      ackReactionScope: undefined,
      useAccessGroups: false,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as unknown,
      runtime: {
        error: vi.fn(),
      },
    };

    const mockAccount = {
      accountId: "test-account",
      config: {} as unknown,
    };

    const messageHandler = createSlackMessageHandler({
      ctx: mockContext as SlackMonitorContext,
      account: mockAccount as unknown,
    });

    // Create a simple channel message (not a DM)
    const message: SlackMessageEvent = {
      type: "message",
      channel: "C0AHD2T3BB3",
      channel_type: "channel",
      user: "U123",
      text: "Test message PRD-123",
      ts: "1234567890.123456",
    };

    // Trigger the message handler
    await messageHandler(message, { source: "message", wasMentioned: false });

    // Wait for debouncer to flush (default is 1000ms, but we can wait a bit)
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Verify hook was triggered
    expect(handler).toHaveBeenCalled();
    expect(hookEvents).toHaveLength(1);

    const event = hookEvents[0];
    expect(event.type).toBe("message");
    expect(event.action).toBe("inbound");
    expect(event.context.channel).toBe("slack");
    expect(event.context.channelId).toBe("C0AHD2T3BB3");
    expect(event.context.text).toBe("Test message PRD-123");
  });

  it("should trigger hook even when message is not prepared (e.g., no mention)", async () => {
    const hookEvents: unknown[] = [];
    const handler = vi.fn((event) => {
      hookEvents.push(event);
    });

    registerInternalHook("message:inbound", handler);

    // Mock context with mention requirement enabled
    const mockContext: Partial<SlackMonitorContext> = {
      accountId: "test-account",
      teamId: "T123",
      cfg: {} as unknown,
      channelsConfig: {},
      allowFrom: [],
      app: {
        client: {
          conversations: {
            info: vi.fn().mockResolvedValue({
              ok: true,
              channel: { name: "test-channel", is_channel: true },
            }),
          },
          users: {
            info: vi.fn().mockResolvedValue({
              ok: true,
              user: { name: "testuser", real_name: "Test User" },
            }),
          },
        } as unknown,
      } as App,
      botToken: "xoxb-test",
      botUserId: "U0BOTUSER",
      markMessageSeen: vi.fn().mockReturnValue(false),
      resolveChannelName: vi.fn().mockResolvedValue({ name: "test-channel", type: "channel" }),
      resolveUserName: vi.fn().mockResolvedValue({ name: "testuser" }),
      isChannelAllowed: vi.fn().mockReturnValue(true),
      dmEnabled: false,
      dmPolicy: "disabled",
      defaultRequireMention: true, // Require mention
      threadInheritParent: false,
      threadHistoryScope: "channel" as const,
      historyLimit: 0,
      channelHistories: new Map(),
      mediaMaxBytes: 0,
      ackReactionScope: undefined,
      useAccessGroups: false,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as unknown,
      runtime: {
        error: vi.fn(),
      },
    };

    const mockAccount = {
      accountId: "test-account",
      config: {} as unknown,
    };

    const messageHandler = createSlackMessageHandler({
      ctx: mockContext as SlackMonitorContext,
      account: mockAccount as unknown,
    });

    // Message without mention (will not be prepared but hook should still fire)
    const message: SlackMessageEvent = {
      type: "message",
      channel: "C0AHD2T3BB3",
      channel_type: "channel",
      user: "U123",
      text: "Test message without mention",
      ts: "1234567890.123456",
    };

    await messageHandler(message, { source: "message", wasMentioned: false });

    // Wait for debouncer
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Hook should still be triggered even though message wasn't prepared
    expect(handler).toHaveBeenCalled();
    expect(hookEvents).toHaveLength(1);

    const event = hookEvents[0];
    expect(event.type).toBe("message");
    expect(event.action).toBe("inbound");
    expect(event.context.channel).toBe("slack");
    expect(event.context.text).toBe("Test message without mention");
  });

  it("should trigger hook for both general 'message' and specific 'message:inbound' handlers", async () => {
    const generalHandler = vi.fn();
    const specificHandler = vi.fn();

    registerInternalHook("message", generalHandler);
    registerInternalHook("message:inbound", specificHandler);

    const mockContext: Partial<SlackMonitorContext> = {
      accountId: "test-account",
      teamId: "T123",
      cfg: {} as unknown,
      channelsConfig: {},
      allowFrom: [],
      app: {
        client: {
          conversations: {
            info: vi.fn().mockResolvedValue({
              ok: true,
              channel: { name: "test-channel", is_channel: true },
            }),
          },
          users: {
            info: vi.fn().mockResolvedValue({
              ok: true,
              user: { name: "testuser", real_name: "Test User" },
            }),
          },
        } as unknown,
      } as App,
      botToken: "xoxb-test",
      botUserId: "U0BOTUSER",
      markMessageSeen: vi.fn().mockReturnValue(false),
      resolveChannelName: vi.fn().mockResolvedValue({ name: "test-channel", type: "channel" }),
      resolveUserName: vi.fn().mockResolvedValue({ name: "testuser" }),
      isChannelAllowed: vi.fn().mockReturnValue(true),
      dmEnabled: false,
      dmPolicy: "disabled",
      defaultRequireMention: false,
      threadInheritParent: false,
      threadHistoryScope: "channel" as const,
      historyLimit: 0,
      channelHistories: new Map(),
      mediaMaxBytes: 0,
      ackReactionScope: undefined,
      useAccessGroups: false,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as unknown,
      runtime: {
        error: vi.fn(),
      },
    };

    const mockAccount = {
      accountId: "test-account",
      config: {} as unknown,
    };

    const messageHandler = createSlackMessageHandler({
      ctx: mockContext as SlackMonitorContext,
      account: mockAccount as unknown,
    });

    const message: SlackMessageEvent = {
      type: "message",
      channel: "C0AHD2T3BB3",
      channel_type: "channel",
      user: "U123",
      text: "Test message",
      ts: "1234567890.123456",
    };

    await messageHandler(message, { source: "message", wasMentioned: false });

    // Wait for debouncer
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Both handlers should be triggered
    expect(generalHandler).toHaveBeenCalled();
    expect(specificHandler).toHaveBeenCalled();
  });
});

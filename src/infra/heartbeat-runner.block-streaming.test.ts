import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { telegramPlugin } from "../../extensions/telegram/src/channel.js";
import { setTelegramRuntime } from "../../extensions/telegram/src/runtime.js";
import * as replyModule from "../auto-reply/reply.js";
import { resolveMainSessionKey } from "../config/sessions.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import { createPluginRuntime } from "../plugins/runtime/index.js";
import { createTestRegistry } from "../test-utils/channel-plugins.js";
import { runHeartbeatOnce } from "./heartbeat-runner.js";

// Avoid pulling optional runtime deps during isolated runs.
vi.mock("jiti", () => ({ createJiti: () => () => ({}) }));

beforeEach(() => {
  const runtime = createPluginRuntime();
  setTelegramRuntime(runtime);
  setActivePluginRegistry(
    createTestRegistry([{ pluginId: "telegram", plugin: telegramPlugin, source: "test" }]),
  );
});

describe("runHeartbeatOnce block streaming", () => {
  it("provides onBlockReply callback when blockStreamingDefault is 'on'", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-hb-block-"));
    const storePath = path.join(tmpDir, "sessions.json");
    const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
    try {
      const cfg: OpenClawConfig = {
        agents: {
          defaults: {
            workspace: tmpDir,
            heartbeat: { every: "5m", target: "telegram" },
          },
          list: [{ id: "main", default: true, blockStreamingDefault: "on" }],
        },
        channels: { telegram: { allowFrom: ["*"] } },
        session: { store: storePath },
      };
      const sessionKey = resolveMainSessionKey(cfg);

      await fs.writeFile(
        storePath,
        JSON.stringify(
          {
            [sessionKey]: {
              sessionId: "sid",
              updatedAt: Date.now(),
              lastChannel: "telegram",
              lastTo: "123",
            },
          },
          null,
          2,
        ),
      );

      replySpy.mockResolvedValue([{ text: "Alert message" }]);
      const sendTelegram = vi.fn().mockResolvedValue({
        messageId: "m1",
        chatId: "123",
      });

      await runHeartbeatOnce({
        cfg,
        deps: {
          sendTelegram,
          getQueueSize: () => 0,
          nowMs: () => 0,
        },
      });

      expect(replySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isHeartbeat: true,
          disableBlockStreaming: false,
          onBlockReply: expect.any(Function),
        }),
        cfg,
      );
    } finally {
      replySpy.mockRestore();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("does not provide onBlockReply when blockStreamingDefault is 'off'", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-hb-block-"));
    const storePath = path.join(tmpDir, "sessions.json");
    const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
    try {
      const cfg: OpenClawConfig = {
        agents: {
          defaults: {
            workspace: tmpDir,
            heartbeat: { every: "5m", target: "telegram" },
          },
          list: [{ id: "main", default: true, blockStreamingDefault: "off" }],
        },
        channels: { telegram: { allowFrom: ["*"] } },
        session: { store: storePath },
      };
      const sessionKey = resolveMainSessionKey(cfg);

      await fs.writeFile(
        storePath,
        JSON.stringify(
          {
            [sessionKey]: {
              sessionId: "sid",
              updatedAt: Date.now(),
              lastChannel: "telegram",
              lastTo: "123",
            },
          },
          null,
          2,
        ),
      );

      replySpy.mockResolvedValue([{ text: "Alert message" }]);
      const sendTelegram = vi.fn().mockResolvedValue({
        messageId: "m1",
        chatId: "123",
      });

      await runHeartbeatOnce({
        cfg,
        deps: {
          sendTelegram,
          getQueueSize: () => 0,
          nowMs: () => 0,
        },
      });

      expect(replySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isHeartbeat: true,
          disableBlockStreaming: undefined,
        }),
        cfg,
      );

      // Should NOT have onBlockReply callback
      const callOptions = replySpy.mock.calls[0][1];
      expect(callOptions?.onBlockReply).toBeUndefined();
    } finally {
      replySpy.mockRestore();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("calls deliverOutboundPayloads with block payloads when onBlockReply is invoked", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-hb-block-"));
    const storePath = path.join(tmpDir, "sessions.json");
    const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
    try {
      const cfg: OpenClawConfig = {
        agents: {
          defaults: {
            workspace: tmpDir,
            heartbeat: { every: "5m", target: "telegram" },
          },
          list: [{ id: "main", default: true, blockStreamingDefault: "on" }],
        },
        channels: { telegram: { allowFrom: ["*"] } },
        session: { store: storePath },
      };
      const sessionKey = resolveMainSessionKey(cfg);

      await fs.writeFile(
        storePath,
        JSON.stringify(
          {
            [sessionKey]: {
              sessionId: "sid",
              updatedAt: Date.now(),
              lastChannel: "telegram",
              lastTo: "123",
            },
          },
          null,
          2,
        ),
      );

      // Mock that getReplyFromConfig will invoke onBlockReply callback
      replySpy.mockImplementation(async (_ctx, opts) => {
        // Simulate block streaming by calling onBlockReply
        if (opts?.onBlockReply) {
          await opts.onBlockReply({ text: "Block 1" });
          await opts.onBlockReply({ text: "Block 2" });
        }
        return [{ text: "Final message" }];
      });

      const sendTelegram = vi.fn().mockResolvedValue({
        messageId: "m1",
        chatId: "123",
      });

      await runHeartbeatOnce({
        cfg,
        deps: {
          sendTelegram,
          getQueueSize: () => 0,
          nowMs: () => 0,
        },
      });

      // Verify that sendTelegram was called for block payloads
      // (It should be called 3 times: 2 blocks + 1 final)
      expect(sendTelegram).toHaveBeenCalledTimes(3);
      // Check the second argument (text) for each call
      expect(sendTelegram.mock.calls[0][1]).toBe("Block 1");
      expect(sendTelegram.mock.calls[1][1]).toBe("Block 2");
      expect(sendTelegram.mock.calls[2][1]).toBe("Final message");
    } finally {
      replySpy.mockRestore();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

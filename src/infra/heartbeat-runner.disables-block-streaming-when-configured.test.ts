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

describe("runHeartbeatOnce", () => {
  it("disables block streaming when blockStreamingDefault is on", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-hb-"));
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
        { isHeartbeat: true, disableBlockStreaming: false },
        cfg,
      );
    } finally {
      replySpy.mockRestore();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("does not set disableBlockStreaming when blockStreamingDefault is off", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-hb-"));
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
        { isHeartbeat: true, disableBlockStreaming: undefined },
        cfg,
      );
    } finally {
      replySpy.mockRestore();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("does not set disableBlockStreaming when blockStreamingDefault is unset", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-hb-"));
    const storePath = path.join(tmpDir, "sessions.json");
    const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
    try {
      const cfg: OpenClawConfig = {
        agents: {
          defaults: {
            workspace: tmpDir,
            heartbeat: { every: "5m", target: "telegram" },
          },
          list: [
            { id: "main", default: true },
            // blockStreamingDefault is not set
          ],
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
        { isHeartbeat: true, disableBlockStreaming: undefined },
        cfg,
      );
    } finally {
      replySpy.mockRestore();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

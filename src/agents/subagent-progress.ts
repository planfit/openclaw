import type { DeliveryContext } from "../utils/delivery-context.js";
import { routeReply } from "../auto-reply/reply/route-reply.js";
import { loadConfig } from "../config/config.js";
import {
  getAgentRunContext,
  onAgentEvent,
  resolveRunIdBySessionKey,
} from "../infra/agent-events.js";
import { defaultRuntime } from "../runtime.js";
import { reactSlackMessage, removeSlackReaction } from "../slack/actions.js";
import { maybeQueueSubagentAnnounce } from "./subagent-announce.js";
import { resolveToolDisplay, formatToolSummary } from "./tool-display.js";
import { normalizeToolName } from "./tool-policy.js";

export type SubagentProgressConfig = {
  runId: string;
  childSessionKey: string;
  requesterSessionKey: string;
  requesterOrigin?: DeliveryContext;
  label?: string;
  /** Channel status message minimum interval (ms). default: 5000 */
  channelThrottleMs?: number;
  /** Parent agent intermediate report interval (ms). default: 30000 */
  parentReportIntervalMs?: number;
  /** When true, skip relaying tool summaries to the channel (e.g. group chats, native commands). */
  suppressChannelRelay?: boolean;
};

type ToolUsageEntry = {
  name: string;
  count: number;
};

type ProgressState = {
  toolCounts: Map<string, number>;
  currentTool: string | undefined;
  currentDetail: string | undefined;
  lastChannelSendAt: number;
  lastParentReportAt: number;
  startedAt: number;
  slackStartMessageTs?: string;
};

function buildToolSummaryLine(toolName: string, args: unknown): string {
  const display = resolveToolDisplay({ name: toolName, args });
  return formatToolSummary(display);
}

function buildParentProgressMessage(config: SubagentProgressConfig, state: ProgressState): string {
  const label = config.label || config.childSessionKey;
  const toolEntries: ToolUsageEntry[] = [];
  for (const [name, count] of state.toolCounts.entries()) {
    toolEntries.push({ name, count });
  }
  const toolsUsedLine =
    toolEntries.length > 0
      ? toolEntries.map((e) => `${e.name} (${e.count})`).join(", ")
      : "none yet";

  const elapsedMs = Date.now() - state.startedAt;
  const elapsedSec = Math.round(elapsedMs / 1000);

  const currentLine = state.currentTool
    ? `Currently: ${state.currentDetail || state.currentTool}`
    : "Idle";

  return [
    `Subagent "${label}" progress update:`,
    `- Tools used so far: ${toolsUsedLine}`,
    `- ${currentLine}`,
    `- Elapsed: ${elapsedSec}s`,
    "",
    "Briefly update the user on the subagent's progress. One sentence max.",
  ].join("\n");
}

export function subscribeSubagentProgress(config: SubagentProgressConfig): () => void {
  const channelThrottleMs = config.channelThrottleMs ?? 5_000;
  const parentReportIntervalMs = config.parentReportIntervalMs ?? 30_000;

  const state: ProgressState = {
    toolCounts: new Map(),
    currentTool: undefined,
    currentDetail: undefined,
    lastChannelSendAt: 0,
    lastParentReportAt: Date.now(),
    startedAt: Date.now(),
  };

  let parentReportTimer: NodeJS.Timeout | null = null;

  function scheduleParentReport() {
    if (parentReportTimer) {
      return;
    }
    parentReportTimer = setTimeout(() => {
      parentReportTimer = null;
      void relayToParent();
    }, parentReportIntervalMs);
    parentReportTimer.unref?.();
  }

  function shouldSuppressRelay(): boolean {
    if (config.suppressChannelRelay) {
      return true;
    }
    // Check parent run context for suppressToolSummaries (set by dispatch-from-config
    // when ChatType is "group" or CommandSource is "native").
    const parentRunId = resolveRunIdBySessionKey(config.requesterSessionKey);
    if (parentRunId) {
      const parentCtx = getAgentRunContext(parentRunId);
      // If parentCtx is undefined, registerAgentRunContext() hasn't run yet —
      // default to suppressing so early tool events don't leak through.
      if (!parentCtx || parentCtx.suppressToolSummaries) {
        return true;
      }
    }
    return false;
  }

  async function relayToChannel(message: string) {
    if (shouldSuppressRelay()) {
      return;
    }
    if (!config.requesterOrigin?.channel || !config.requesterOrigin?.to) {
      defaultRuntime.log(
        `[subagent-progress] channel relay skipped: channel=${config.requesterOrigin?.channel ?? "none"} to=${config.requesterOrigin?.to ?? "none"} runId=${config.runId}`,
      );
      return;
    }
    const now = Date.now();
    if (now - state.lastChannelSendAt < channelThrottleMs) {
      return;
    }
    state.lastChannelSendAt = now;

    try {
      await routeReply({
        payload: { text: message },
        channel: config.requesterOrigin.channel,
        to: config.requesterOrigin.to,
        sessionKey: config.requesterSessionKey,
        threadId: config.requesterOrigin.threadId,
        cfg: loadConfig(),
      });
    } catch (err) {
      defaultRuntime.log(
        `[subagent-progress] channel relay failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async function relayToParent() {
    const summary = buildParentProgressMessage(config, state);
    state.lastParentReportAt = Date.now();

    try {
      const queued = await maybeQueueSubagentAnnounce({
        requesterSessionKey: config.requesterSessionKey,
        triggerMessage: summary,
        summaryLine: `${config.label || "subagent"}: progress`,
        requesterOrigin: config.requesterOrigin,
      });
      defaultRuntime.log(
        `[subagent-progress] parent report: queued=${queued} runId=${config.runId}`,
      );
    } catch (err) {
      defaultRuntime.log(
        `[subagent-progress] parent relay failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async function sendSlackStartMessage() {
    // Only send for Slack channels when not suppressed
    if (shouldSuppressRelay()) {
      return;
    }
    if (config.requesterOrigin?.channel !== "slack") {
      return;
    }
    if (!config.requesterOrigin?.to) {
      return;
    }

    try {
      const result = await routeReply({
        payload: { text: config.label ? `🧩 Claude Code — ${config.label}` : "🧩 Claude Code" },
        channel: config.requesterOrigin.channel,
        to: config.requesterOrigin.to,
        sessionKey: config.requesterSessionKey,
        threadId: config.requesterOrigin.threadId,
        cfg: loadConfig(),
      });

      if (result.messageId) {
        state.slackStartMessageTs = result.messageId;
        // Add ⏳ reaction to indicate subagent is in progress
        const channelId = config.requesterOrigin.to.replace(/^channel:/, "");
        await reactSlackMessage(channelId, result.messageId, "hourglass_flowing_sand", {});
      }
    } catch (err) {
      defaultRuntime.log(
        `[subagent-progress] slack start message failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async function updateSlackReactionOnComplete(success: boolean) {
    if (!state.slackStartMessageTs) {
      return;
    }
    if (config.requesterOrigin?.channel !== "slack") {
      return;
    }
    if (!config.requesterOrigin?.to) {
      return;
    }

    try {
      const channelId = config.requesterOrigin.to.replace(/^channel:/, "");
      // Remove ⏳ reaction
      await removeSlackReaction(channelId, state.slackStartMessageTs, "hourglass_flowing_sand", {});
      // Add ✅ or ❌ based on success/failure
      const emoji = success ? "white_check_mark" : "x";
      await reactSlackMessage(channelId, state.slackStartMessageTs, emoji, {});
    } catch (err) {
      defaultRuntime.log(
        `[subagent-progress] slack reaction update failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const stopListener = onAgentEvent((evt) => {
    // Handle lifecycle events for subagent start/end
    if (evt && evt.stream === "lifecycle") {
      const matchesRun = evt.runId === config.runId;
      const matchesSession = evt.sessionKey === config.childSessionKey;
      if (!matchesRun && !matchesSession) {
        return;
      }

      const phase = evt.data?.phase;
      if (phase === "start") {
        void sendSlackStartMessage();
      } else if (phase === "end") {
        void updateSlackReactionOnComplete(true);
      } else if (phase === "error") {
        void updateSlackReactionOnComplete(false);
      }
      return;
    }

    if (!evt || evt.stream !== "tool") {
      return;
    }
    const matchesRun = evt.runId === config.runId;
    const matchesSession = evt.sessionKey === config.childSessionKey;
    if (!matchesRun && !matchesSession) {
      return;
    }

    const phase = evt.data?.phase;
    const rawName = typeof evt.data?.name === "string" ? evt.data.name : undefined;
    if (!rawName) {
      return;
    }
    const toolName = normalizeToolName(rawName);

    // Skip internal tool events from SDK-based tools (e.g. claude_code's internal
    // Read/Write/Glob). These are implementation details that shouldn't be relayed
    // to the channel — only the parent tool itself gets a summary via emitToolSummary.
    const parentTool = typeof evt.data?.parentTool === "string" ? evt.data.parentTool : undefined;

    if (phase === "start") {
      // Track tool usage count
      state.toolCounts.set(toolName, (state.toolCounts.get(toolName) ?? 0) + 1);
      state.currentTool = toolName;

      // Build human-readable summary
      const summaryLine = buildToolSummaryLine(toolName, evt.data?.args);
      state.currentDetail = summaryLine;

      defaultRuntime.log(`[subagent-progress] ${summaryLine} (runId=${config.runId})`);

      // Relay to channel (throttled), but skip internal SDK tool events
      if (!parentTool && toolName !== "claude_code") {
        void relayToChannel(summaryLine);
      }

      // Schedule parent report if not already scheduled
      scheduleParentReport();
    } else if (phase === "result") {
      const isError = Boolean(evt.data?.isError);
      if (isError && !parentTool && toolName !== "claude_code") {
        const errorLine = `:x: Tool failed: ${toolName}`;
        defaultRuntime.log(`[subagent-progress] ${errorLine} (runId=${config.runId})`);
        void relayToChannel(errorLine);
      }
      state.currentTool = undefined;
      state.currentDetail = undefined;
    }
  });

  return () => {
    stopListener();
    if (parentReportTimer) {
      clearTimeout(parentReportTimer);
      parentReportTimer = null;
    }
  };
}

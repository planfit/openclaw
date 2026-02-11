import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { runSDKAgent, type SDKProgressEvent } from "./claude-sdk-integration.js";

const claudeCodeSchema = Type.Object({
  prompt: Type.String({ description: "The task or question for Claude Code" }),
  model: Type.Optional(Type.String({ description: "Model override (default: inherited)" })),
});

export type ClaudeCodeToolDetails =
  | { status: "running"; phase: string; info?: string }
  | { status: "completed"; durationMs: number; numTurns: number; sessionId: string };

export function createClaudeCodeTool(defaults?: {
  cwd?: string;
  model?: string;
  maxTurns?: number;
  systemPromptAppend?: string;
  env?: Record<string, string | undefined>;
}): AgentTool<typeof claudeCodeSchema, ClaudeCodeToolDetails> {
  return {
    name: "claude_code",
    label: "Claude Code",
    description:
      "Execute coding tasks using Claude Code with built-in file editing, bash execution, and code analysis tools. Use this for complex coding tasks that require multiple file operations.",
    parameters: claudeCodeSchema,
    execute: async (_toolCallId, params, _signal, onUpdate) => {
      const result = await runSDKAgent({
        prompt: params.prompt,
        cwd: defaults?.cwd ?? process.cwd(),
        model: params.model ?? defaults?.model,
        maxTurns: defaults?.maxTurns,
        systemPromptAppend: defaults?.systemPromptAppend,
        env: defaults?.env,
        onProgress: (evt: SDKProgressEvent) => {
          if (!onUpdate) {
            return;
          }
          let update: AgentToolResult<ClaudeCodeToolDetails>;
          switch (evt.phase) {
            case "init":
              update = {
                content: [
                  { type: "text", text: `Claude Code initialized (${evt.toolCount} tools)` },
                ],
                details: { status: "running", phase: "init", info: `model=${evt.model}` },
              };
              break;
            case "tool_progress":
              update = {
                content: [
                  {
                    type: "text",
                    text: `Running ${evt.toolName} (${evt.elapsedSeconds}s)`,
                  },
                ],
                details: { status: "running", phase: "tool", info: evt.toolName },
              };
              break;
            case "tool_use":
              update = {
                content: [{ type: "text", text: `Using: ${evt.toolNames.join(", ")}` }],
                details: {
                  status: "running",
                  phase: "tool_use",
                  info: evt.toolNames.join(", "),
                },
              };
              break;
            default:
              return;
          }
          onUpdate(update);
        },
      });

      return {
        content: [{ type: "text", text: result.text }],
        details: {
          status: "completed" as const,
          durationMs: result.durationMs,
          numTurns: result.numTurns,
          sessionId: result.sessionId,
        },
      };
    },
  };
}

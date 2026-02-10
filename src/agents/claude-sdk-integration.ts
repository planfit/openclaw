/**
 * Claude Agent SDK Integration
 *
 * subprocess 방식 대신 Claude Agent SDK를 사용하여 Claude Code를 실행합니다.
 * 이를 통해 타임아웃 문제를 해결하고 더 안정적인 에이전트 실행이 가능합니다.
 *
 * @see https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk
 */

import { query, type ClaudeAgentOptions, type Message } from "@anthropic-ai/claude-agent-sdk";

export interface ClaudeSDKExecuteOptions {
  prompt: string;
  cwd: string;
  model?: "sonnet" | "opus" | "haiku";
  maxTurns?: number;
  permissionMode?: "default" | "bypassPermissions" | "plan";
  systemPrompt?: string;
  onProgress?: (message: Message) => void;
  onToolCall?: (toolName: string, input: unknown) => void;
  signal?: AbortSignal;
}

export interface ClaudeSDKResult {
  success: boolean;
  result?: string;
  error?: string;
  totalCostUsd?: number;
  turnCount?: number;
}

/**
 * Claude Agent SDK를 사용하여 Claude Code 실행
 *
 * 기존 subprocess 방식과 달리:
 * - 타임아웃이 필요 없음 (이벤트 기반)
 * - maxTurns로 대화 턴 제한 가능
 * - 타입 안전한 결과 반환
 *
 * @example
 * ```typescript
 * const result = await executeWithClaudeSDK({
 *   prompt: "Fix the login bug in src/auth.ts",
 *   cwd: "/path/to/project",
 *   maxTurns: 100,
 *   onProgress: (msg) => console.log("Progress:", msg.type),
 * });
 *
 * if (result.success) {
 *   console.log("Completed:", result.result);
 * }
 * ```
 */
export async function executeWithClaudeSDK(
  options: ClaudeSDKExecuteOptions,
): Promise<ClaudeSDKResult> {
  const {
    prompt,
    cwd,
    model = "sonnet",
    maxTurns = 250,
    permissionMode = "bypassPermissions",
    systemPrompt,
    onProgress,
    onToolCall,
    signal,
  } = options;

  const sdkOptions: ClaudeAgentOptions = {
    cwd,
    model,
    maxTurns,
    permissionMode,
    ...(systemPrompt && { systemPrompt }),
  };

  let turnCount = 0;

  try {
    for await (const message of query({ prompt, options: sdkOptions })) {
      // AbortSignal 체크
      if (signal?.aborted) {
        return {
          success: false,
          error: "Aborted by user",
          turnCount,
        };
      }

      // 진행 상황 콜백
      if (onProgress) {
        onProgress(message);
      }

      // 메시지 타입별 처리
      switch (message.type) {
        case "assistant":
          turnCount++;
          // 도구 호출 감지
          if (onToolCall && message.content) {
            for (const block of message.content) {
              if (block.type === "tool_use") {
                onToolCall(block.name, block.input);
              }
            }
          }
          break;

        case "result":
          return {
            success: message.subtype === "success",
            result: message.result,
            error: message.subtype === "error" ? message.error : undefined,
            totalCostUsd: message.total_cost_usd,
            turnCount,
          };
      }
    }

    // 정상적으로 종료되지 않은 경우
    return {
      success: false,
      error: "Unexpected end of stream",
      turnCount,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      turnCount,
    };
  }
}

/**
 * 스트리밍 방식으로 Claude Code 실행
 *
 * async generator를 반환하여 실시간으로 메시지를 처리할 수 있습니다.
 *
 * @example
 * ```typescript
 * for await (const event of streamClaudeSDK({
 *   prompt: "Explain this codebase",
 *   cwd: "/path/to/project",
 * })) {
 *   if (event.type === "progress") {
 *     console.log("Working...");
 *   } else if (event.type === "text") {
 *     process.stdout.write(event.text);
 *   } else if (event.type === "complete") {
 *     console.log("Done! Cost:", event.costUsd);
 *   }
 * }
 * ```
 */
export async function* streamClaudeSDK(
  options: Omit<ClaudeSDKExecuteOptions, "onProgress" | "onToolCall">,
): AsyncGenerator<StreamEvent> {
  const {
    prompt,
    cwd,
    model = "sonnet",
    maxTurns = 250,
    permissionMode = "bypassPermissions",
    systemPrompt,
    signal,
  } = options;

  const sdkOptions: ClaudeAgentOptions = {
    cwd,
    model,
    maxTurns,
    permissionMode,
    ...(systemPrompt && { systemPrompt }),
  };

  try {
    for await (const message of query({ prompt, options: sdkOptions })) {
      if (signal?.aborted) {
        yield { type: "error", error: "Aborted by user" };
        return;
      }

      switch (message.type) {
        case "assistant":
          yield { type: "progress", messageType: "assistant" };

          // 텍스트 추출
          if (message.content) {
            for (const block of message.content) {
              if (block.type === "text") {
                yield { type: "text", text: block.text };
              } else if (block.type === "tool_use") {
                yield {
                  type: "tool_call",
                  toolName: block.name,
                  input: block.input,
                };
              }
            }
          }
          break;

        case "result":
          if (message.subtype === "success") {
            yield {
              type: "complete",
              result: message.result,
              costUsd: message.total_cost_usd,
            };
          } else {
            yield { type: "error", error: message.error };
          }
          return;
      }
    }
  } catch (error) {
    yield {
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export type StreamEvent =
  | { type: "progress"; messageType: string }
  | { type: "text"; text: string }
  | { type: "tool_call"; toolName: string; input: unknown }
  | { type: "complete"; result?: string; costUsd?: number }
  | { type: "error"; error: string };

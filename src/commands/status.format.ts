import type { SessionStatus } from "./status.types.js";
import { formatDurationPrecise } from "../infra/format-time/format-duration.ts";

export const formatKTokens = (value: number) =>
  `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`;

export const formatDuration = (ms: number | null | undefined) => {
  if (ms == null || !Number.isFinite(ms)) {
    return "unknown";
  }
  return formatDurationPrecise(ms, { decimals: 1 });
};

export const shortenText = (value: string, maxLen: number) => {
  const chars = Array.from(value);
  if (chars.length <= maxLen) {
    return value;
  }
  return `${chars.slice(0, Math.max(0, maxLen - 1)).join("")}…`;
};

export const formatTokensCompact = (
  sess: Pick<
    SessionStatus,
    "inputTokens" | "totalTokens" | "contextTokens" | "percentUsed" | "cacheRead" | "cacheWrite"
  >,
) => {
  const used = sess.totalTokens;
  const ctx = sess.contextTokens;
  const cacheRead = sess.cacheRead;
  const cacheWrite = sess.cacheWrite;
  const inputTokens = sess.inputTokens;

  let result = "";
  if (used == null) {
    result = "0 used";
  } else if (!ctx) {
    result = `${formatKTokens(used)} used`;
  } else {
    const pctLabel = sess.percentUsed != null ? `${sess.percentUsed}%` : "?%";
    result = `${formatKTokens(used)}/${formatKTokens(ctx)} (${pctLabel})`;
  }

  // Add cache hit rate if there are cached reads
  if (typeof cacheRead === "number" && cacheRead > 0) {
    const cacheWriteTokens =
      typeof cacheWrite === "number" && Number.isFinite(cacheWrite) && cacheWrite >= 0
        ? cacheWrite
        : 0;
    const promptTokensFromParts =
      typeof inputTokens === "number" && Number.isFinite(inputTokens) && inputTokens >= 0
        ? inputTokens + cacheRead + cacheWriteTokens
        : undefined;
    // Legacy entries can carry an undersized totalTokens value. Keep the cache
    // denominator aligned with the prompt-side token fields when available, and
    // never let the fallback denominator drop below the known cached prompt
    // tokens.
    const total =
      promptTokensFromParts ??
      (typeof used === "number" && Number.isFinite(used) && used > 0
        ? Math.max(used, cacheRead + cacheWriteTokens)
        : cacheRead + cacheWriteTokens);
    const hitRate = Math.round((cacheRead / total) * 100);
    result += ` · 🗄️ ${hitRate}% cached`;
  }

  return result;
};

export const formatDaemonRuntimeShort = (runtime?: {
  status?: string;
  pid?: number;
  state?: string;
  detail?: string;
  missingUnit?: boolean;
}) => {
  if (!runtime) {
    return null;
  }
  const status = runtime.status ?? "unknown";
  const details: string[] = [];
  if (runtime.pid) {
    details.push(`pid ${runtime.pid}`);
  }
  if (runtime.state && runtime.state.toLowerCase() !== status) {
    details.push(`state ${runtime.state}`);
  }
  const detail = runtime.detail?.replace(/\s+/g, " ").trim() || "";
  const noisyLaunchctlDetail =
    runtime.missingUnit === true && detail.toLowerCase().includes("could not find service");
  if (detail && !noisyLaunchctlDetail) {
    details.push(detail);
  }
  return details.length > 0 ? `${status} (${details.join(", ")})` : status;
};

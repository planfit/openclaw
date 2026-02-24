import {
  buildAgentMainSessionKey,
  buildAgentPeerSessionKey,
  resolveThreadSessionKeys,
} from "../../routing/session-key.js";

export interface DeliveryContext {
  channel?: string;
  to?: string;
  threadId?: string | number | null;
  accountId?: string;
}

/**
 * Resolve the correct session key for cron delivery based on delivery context.
 *
 * @param params - Parameters containing agentId and delivery context
 * @returns Session key string
 *
 * @remarks
 * - If delivery.to is not a channel (missing, empty, or doesn't start with "channel:"),
 *   returns the main session key: `agent:${agentId}:main`
 * - If delivery.to is "channel:XXXXX", returns a channel-specific session key:
 *   `agent:${agentId}:${channel}:channel:${channelId}`
 * - If threadId is also provided, appends thread suffix:
 *   `agent:${agentId}:${channel}:channel:${channelId}:thread:${threadId}`
 *
 * @example
 * ```ts
 * // No channel info → agent:main:main
 * resolveDeliverySessionKey({ agentId: "main", delivery: {} })
 *
 * // Slack channel → agent:main:slack:channel:c0ad56w375g
 * resolveDeliverySessionKey({
 *   agentId: "main",
 *   delivery: { channel: "slack", to: "channel:C0AD56W375G" }
 * })
 *
 * // With thread → agent:main:slack:channel:c123:thread:1234567890.123456
 * resolveDeliverySessionKey({
 *   agentId: "main",
 *   delivery: {
 *     channel: "slack",
 *     to: "channel:C123",
 *     threadId: "1234567890.123456"
 *   }
 * })
 * ```
 */
export function resolveDeliverySessionKey(params: {
  agentId: string;
  delivery: DeliveryContext;
}): string {
  const { agentId, delivery } = params;

  // Normalize inputs
  const channel = (delivery.channel ?? "").trim().toLowerCase();
  const to = (delivery.to ?? "").trim();
  const threadId =
    typeof delivery.threadId === "number"
      ? String(delivery.threadId)
      : (delivery.threadId ?? "").trim();

  // Fallback to main session if no channel or to is missing/empty
  if (!channel || !to) {
    return buildAgentMainSessionKey({ agentId });
  }

  // Check if 'to' is a channel (format: "channel:XXXXX")
  const channelPrefix = "channel:";
  if (!to.toLowerCase().startsWith(channelPrefix)) {
    return buildAgentMainSessionKey({ agentId });
  }

  // Extract channel ID from "channel:XXXXX"
  const channelId = to.slice(channelPrefix.length).trim().toLowerCase();
  if (!channelId) {
    return buildAgentMainSessionKey({ agentId });
  }

  // Build base channel session key
  const baseSessionKey = buildAgentPeerSessionKey({
    agentId,
    channel,
    peerKind: "channel",
    peerId: channelId,
    accountId: delivery.accountId,
  });

  // Add thread suffix if threadId is provided and non-empty
  if (threadId) {
    const { sessionKey } = resolveThreadSessionKeys({
      baseSessionKey,
      threadId,
    });
    return sessionKey;
  }

  return baseSessionKey;
}

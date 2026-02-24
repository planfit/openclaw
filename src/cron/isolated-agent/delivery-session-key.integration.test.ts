import { describe, expect, it } from "vitest";
import { resolveDeliverySessionKey } from "./delivery-session-key.js";

/**
 * Integration test to verify the bug fix:
 * When delivery.to is "channel:C0AD56W375G", the sessionKey should be
 * "agent:main:slack:channel:c0ad56w375g" instead of "agent:main:main"
 */
describe("resolveDeliverySessionKey - Bug Fix Integration", () => {
  it("BUGFIX: resolves correct sessionKey for Slack channel delivery (issue: always returned agent:main:main)", () => {
    // BEFORE FIX: This would incorrectly return "agent:main:main"
    // AFTER FIX: This should correctly return "agent:main:slack:channel:c0ad56w375g"
    const result = resolveDeliverySessionKey({
      agentId: "main",
      delivery: {
        channel: "slack",
        to: "channel:C0AD56W375G",
      },
    });

    // The bug was that requesterSessionKey was always agent:main:main
    expect(result).not.toBe("agent:main:main");

    // Instead it should be the channel-specific session key
    expect(result).toBe("agent:main:slack:channel:c0ad56w375g");
  });

  it("BUGFIX: includes threadId when provided for Slack channel delivery", () => {
    // When threadId is also provided, it should be appended
    const result = resolveDeliverySessionKey({
      agentId: "main",
      delivery: {
        channel: "slack",
        to: "channel:C0AD56W375G",
        threadId: "1234567890.123456",
      },
    });

    expect(result).toBe("agent:main:slack:channel:c0ad56w375g:thread:1234567890.123456");
  });

  it("still returns agent:main:main for non-channel deliveries (backward compatibility)", () => {
    // When delivery is not to a channel, fallback to main session
    const result = resolveDeliverySessionKey({
      agentId: "main",
      delivery: {
        channel: "slack",
        to: "U123456", // User ID, not a channel
      },
    });

    expect(result).toBe("agent:main:main");
  });

  it("still returns agent:main:main when no delivery info is provided (backward compatibility)", () => {
    // When no delivery context, fallback to main session
    const result = resolveDeliverySessionKey({
      agentId: "main",
      delivery: {},
    });

    expect(result).toBe("agent:main:main");
  });
});

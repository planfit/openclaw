import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveOutboundTarget: vi.fn(() => ({ ok: true as const, to: "+1999" })),
}));

vi.mock("./targets.js", async () => {
  const actual = await vi.importActual<typeof import("./targets.js")>("./targets.js");
  return {
    ...actual,
    resolveOutboundTarget: mocks.resolveOutboundTarget,
  };
});

import type { OpenClawConfig } from "../../config/config.js";
import { resolveAgentDeliveryPlan, resolveAgentOutboundTarget } from "./agent-delivery.js";

describe("agent delivery helpers", () => {
  it("builds a delivery plan from session delivery context", () => {
    const plan = resolveAgentDeliveryPlan({
      sessionEntry: {
        deliveryContext: { channel: "whatsapp", to: "+1555", accountId: "work" },
      },
      requestedChannel: "last",
      explicitTo: undefined,
      accountId: undefined,
      wantsDelivery: true,
    });

    expect(plan.resolvedChannel).toBe("whatsapp");
    expect(plan.resolvedTo).toBe("+1555");
    expect(plan.resolvedAccountId).toBe("work");
    expect(plan.deliveryTargetMode).toBe("implicit");
  });

  it("resolves fallback targets when no explicit destination is provided", () => {
    const plan = resolveAgentDeliveryPlan({
      sessionEntry: {
        deliveryContext: { channel: "whatsapp" },
      },
      requestedChannel: "last",
      explicitTo: undefined,
      accountId: undefined,
      wantsDelivery: true,
    });

    const resolved = resolveAgentOutboundTarget({
      cfg: {} as OpenClawConfig,
      plan,
      targetMode: "implicit",
    });

    expect(mocks.resolveOutboundTarget).toHaveBeenCalledTimes(1);
    expect(resolved.resolvedTarget?.ok).toBe(true);
    expect(resolved.resolvedTo).toBe("+1999");
  });

  it("skips outbound target resolution when explicit target validation is disabled", () => {
    const plan = resolveAgentDeliveryPlan({
      sessionEntry: {
        deliveryContext: { channel: "whatsapp", to: "+1555" },
      },
      requestedChannel: "last",
      explicitTo: "+1555",
      accountId: undefined,
      wantsDelivery: true,
    });

    mocks.resolveOutboundTarget.mockClear();
    const resolved = resolveAgentOutboundTarget({
      cfg: {} as OpenClawConfig,
      plan,
      targetMode: "explicit",
      validateExplicitTarget: false,
    });

    expect(mocks.resolveOutboundTarget).not.toHaveBeenCalled();
    expect(resolved.resolvedTo).toBe("+1555");
  });

  it("prioritizes explicit threadId over session-derived threadId", () => {
    const plan = resolveAgentDeliveryPlan({
      sessionEntry: {
        deliveryContext: {
          channel: "slack",
          to: "C0123456789",
          threadId: "9999999999.999999",
          lastTo: "C0123456789",
        },
      },
      requestedChannel: "slack",
      explicitTo: "C0123456789",
      explicitThreadId: "1234567890.123456",
      accountId: undefined,
      wantsDelivery: true,
    });

    expect(plan.resolvedThreadId).toBe("1234567890.123456");
  });

  it("falls back to session threadId when no explicit threadId and same recipient", () => {
    const plan = resolveAgentDeliveryPlan({
      sessionEntry: {
        deliveryContext: {
          channel: "slack",
          to: "C0123456789",
          threadId: "9999999999.999999",
          lastTo: "C0123456789",
        },
      },
      requestedChannel: "slack",
      explicitTo: undefined,
      explicitThreadId: undefined,
      accountId: undefined,
      wantsDelivery: true,
    });

    expect(plan.resolvedThreadId).toBe("9999999999.999999");
  });

  it("ignores session threadId when recipient changed", () => {
    // Scenario: last conversation was with D9999999999 (DM) in a thread,
    // but now we explicitly want to send to C0123456789 (channel).
    // The threadId from the DM conversation should NOT be used for the channel.
    const plan = resolveAgentDeliveryPlan({
      sessionEntry: {
        deliveryContext: {
          channel: "slack",
          to: "D9999999999",
          threadId: "9999999999.999999",
        },
      },
      requestedChannel: "slack",
      explicitTo: "C0123456789",
      explicitThreadId: undefined,
      accountId: undefined,
      wantsDelivery: true,
    });

    expect(plan.resolvedTo).toBe("C0123456789");
    expect(plan.resolvedThreadId).toBeUndefined();
  });
});

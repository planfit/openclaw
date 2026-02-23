import { describe, expect, it } from "vitest";
import { resolveAgentDeliveryPlan } from "./agent-delivery.js";

describe("agent-delivery threadId resolution", () => {
  describe("explicit threadId handling", () => {
    it("prioritizes explicit threadId over session threadId", () => {
      // Regression test for: cron jobs with explicit threadId being ignored by gateway
      // Bug: gateway's resolveAgentDeliveryPlan was returning baseDelivery.threadId
      // instead of prioritizing params.explicitThreadId when present.
      //
      // Scenario: Cron job wants to deliver to Slack channel C0123 in thread 1234567890.123456,
      // but the session's last activity was in a different thread (9999999999.999999).
      const plan = resolveAgentDeliveryPlan({
        sessionEntry: {
          deliveryContext: {
            channel: "slack",
            to: "C0123456789",
            threadId: "9999999999.999999",
          },
        },
        requestedChannel: "slack",
        explicitTo: "C0123456789",
        explicitThreadId: "1234567890.123456",
        accountId: undefined,
        wantsDelivery: true,
      });

      expect(plan.resolvedThreadId).toBe("1234567890.123456");
      expect(plan.resolvedChannel).toBe("slack");
      expect(plan.resolvedTo).toBe("C0123456789");
    });

    it("uses explicit threadId even when zero", () => {
      // Edge case: threadId 0 is a valid Telegram supergroup topic ID
      const plan = resolveAgentDeliveryPlan({
        sessionEntry: {
          deliveryContext: {
            channel: "telegram",
            to: "-1001234567890",
            threadId: 12345,
          },
        },
        requestedChannel: "telegram",
        explicitTo: "-1001234567890",
        explicitThreadId: 0,
        accountId: undefined,
        wantsDelivery: true,
      });

      expect(plan.resolvedThreadId).toBe(0);
    });
  });

  describe("implicit threadId handling", () => {
    it("uses session threadId when recipient matches last conversation", () => {
      const plan = resolveAgentDeliveryPlan({
        sessionEntry: {
          deliveryContext: {
            channel: "slack",
            to: "C0123456789",
            threadId: "1234567890.123456",
          },
        },
        requestedChannel: "slack",
        explicitTo: undefined,
        explicitThreadId: undefined,
        accountId: undefined,
        wantsDelivery: true,
      });

      expect(plan.resolvedTo).toBe("C0123456789");
      expect(plan.resolvedThreadId).toBe("1234567890.123456");
    });

    it("discards session threadId when recipient changes", () => {
      // Scenario: Last conversation was with D9999999999 (DM) in thread 9999999999.999999,
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

    it("discards session threadId when channel changes", () => {
      const plan = resolveAgentDeliveryPlan({
        sessionEntry: {
          deliveryContext: {
            channel: "telegram",
            to: "123456",
            threadId: 789,
          },
        },
        requestedChannel: "slack",
        explicitTo: "C0123456789",
        explicitThreadId: undefined,
        accountId: undefined,
        wantsDelivery: true,
      });

      expect(plan.resolvedChannel).toBe("slack");
      expect(plan.resolvedTo).toBe("C0123456789");
      expect(plan.resolvedThreadId).toBeUndefined();
    });

    it("handles missing session threadId gracefully", () => {
      const plan = resolveAgentDeliveryPlan({
        sessionEntry: {
          deliveryContext: {
            channel: "slack",
            to: "C0123456789",
          },
        },
        requestedChannel: "slack",
        explicitTo: undefined,
        explicitThreadId: undefined,
        accountId: undefined,
        wantsDelivery: true,
      });

      expect(plan.resolvedTo).toBe("C0123456789");
      expect(plan.resolvedThreadId).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("handles empty string threadId as undefined", () => {
      const plan = resolveAgentDeliveryPlan({
        sessionEntry: {
          deliveryContext: {
            channel: "slack",
            to: "C0123456789",
            threadId: "",
          },
        },
        requestedChannel: "slack",
        explicitTo: "C0123456789",
        explicitThreadId: undefined,
        accountId: undefined,
        wantsDelivery: true,
      });

      // Empty string threadId is normalized to undefined by resolveSessionDeliveryTarget
      expect(plan.resolvedThreadId).toBeUndefined();
    });

    it("handles null recipient gracefully", () => {
      const plan = resolveAgentDeliveryPlan({
        sessionEntry: {
          deliveryContext: {
            channel: "slack",
            threadId: "1234567890.123456",
          },
        },
        requestedChannel: "slack",
        explicitTo: undefined,
        explicitThreadId: undefined,
        accountId: undefined,
        wantsDelivery: true,
      });

      expect(plan.resolvedTo).toBeUndefined();
      // No recipient means we can't verify if threadId is safe to use
      expect(plan.resolvedThreadId).toBeUndefined();
    });
  });
});

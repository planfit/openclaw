import { describe, expect, it } from "vitest";
import { resolveDeliverySessionKey } from "./delivery-session-key.js";

describe("resolveDeliverySessionKey", () => {
  it("returns agent:main:main when delivery context has no channel info", () => {
    const result = resolveDeliverySessionKey({
      agentId: "main",
      delivery: {},
    });
    expect(result).toBe("agent:main:main");
  });

  it("returns agent:main:main when delivery.to is undefined", () => {
    const result = resolveDeliverySessionKey({
      agentId: "main",
      delivery: {
        channel: "slack",
      },
    });
    expect(result).toBe("agent:main:main");
  });

  it("returns agent:main:main when delivery.to is empty string", () => {
    const result = resolveDeliverySessionKey({
      agentId: "main",
      delivery: {
        channel: "slack",
        to: "",
      },
    });
    expect(result).toBe("agent:main:main");
  });

  it("returns agent:main:slack:channel:c0ad56w375g when delivery.to is channel:C0AD56W375G", () => {
    const result = resolveDeliverySessionKey({
      agentId: "main",
      delivery: {
        channel: "slack",
        to: "channel:C0AD56W375G",
      },
    });
    expect(result).toBe("agent:main:slack:channel:c0ad56w375g");
  });

  it("returns agent:main:slack:channel:c123:thread:1234567890.123456 when threadId is provided", () => {
    const result = resolveDeliverySessionKey({
      agentId: "main",
      delivery: {
        channel: "slack",
        to: "channel:C123",
        threadId: "1234567890.123456",
      },
    });
    expect(result).toBe("agent:main:slack:channel:c123:thread:1234567890.123456");
  });

  it("returns agent:main:slack:channel:c123 when threadId is undefined", () => {
    const result = resolveDeliverySessionKey({
      agentId: "main",
      delivery: {
        channel: "slack",
        to: "channel:C123",
        threadId: undefined,
      },
    });
    expect(result).toBe("agent:main:slack:channel:c123");
  });

  it("returns agent:main:slack:channel:c123 when threadId is empty string", () => {
    const result = resolveDeliverySessionKey({
      agentId: "main",
      delivery: {
        channel: "slack",
        to: "channel:C123",
        threadId: "",
      },
    });
    expect(result).toBe("agent:main:slack:channel:c123");
  });

  it("returns agent:main:slack:channel:c123:thread:0 when threadId is numeric 0", () => {
    const result = resolveDeliverySessionKey({
      agentId: "main",
      delivery: {
        channel: "slack",
        to: "channel:C123",
        threadId: 0,
      },
    });
    expect(result).toBe("agent:main:slack:channel:c123:thread:0");
  });

  it("handles custom agentId correctly", () => {
    const result = resolveDeliverySessionKey({
      agentId: "custom-agent",
      delivery: {
        channel: "slack",
        to: "channel:C123",
      },
    });
    expect(result).toBe("agent:custom-agent:slack:channel:c123");
  });

  it("normalizes channel ID to lowercase", () => {
    const result = resolveDeliverySessionKey({
      agentId: "main",
      delivery: {
        channel: "slack",
        to: "channel:UPPERCASE",
      },
    });
    expect(result).toBe("agent:main:slack:channel:uppercase");
  });

  it("handles Telegram channel format", () => {
    const result = resolveDeliverySessionKey({
      agentId: "main",
      delivery: {
        channel: "telegram",
        to: "channel:-1001234567890",
      },
    });
    expect(result).toBe("agent:main:telegram:channel:-1001234567890");
  });

  it("falls back to agent:main:main when delivery.to doesn't start with 'channel:'", () => {
    const result = resolveDeliverySessionKey({
      agentId: "main",
      delivery: {
        channel: "slack",
        to: "U123456",
      },
    });
    expect(result).toBe("agent:main:main");
  });

  it("falls back to agent:main:main when delivery.to is 'last'", () => {
    const result = resolveDeliverySessionKey({
      agentId: "main",
      delivery: {
        channel: "last",
        to: "last",
      },
    });
    expect(result).toBe("agent:main:main");
  });

  it("extracts channel ID from 'channel:XXX' format correctly", () => {
    const result = resolveDeliverySessionKey({
      agentId: "main",
      delivery: {
        channel: "slack",
        to: "channel:C0AD56W375G",
      },
    });
    expect(result).toBe("agent:main:slack:channel:c0ad56w375g");
  });
});

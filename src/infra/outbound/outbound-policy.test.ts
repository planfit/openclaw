import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { enforceCrossContextPolicy } from "./outbound-policy.js";

const slackConfig = {
  channels: {
    slack: {
      botToken: "xoxb-test",
      appToken: "xapp-test",
    },
  },
} as OpenClawConfig;

describe("outbound policy", () => {
  it("blocks cross-provider sends by default", () => {
    expect(() =>
      enforceCrossContextPolicy({
        cfg: slackConfig,
        channel: "telegram",
        action: "send",
        args: { to: "telegram:@ops" },
        toolContext: { currentChannelId: "C12345678", currentChannelProvider: "slack" },
      }),
    ).toThrow(/Cross-context messaging denied/);
  });

  it("allows cross-provider sends when enabled", () => {
    const cfg = {
      ...slackConfig,
      tools: {
        message: { crossContext: { allowAcrossProviders: true } },
      },
    } as OpenClawConfig;

    expect(() =>
      enforceCrossContextPolicy({
        cfg,
        channel: "telegram",
        action: "send",
        args: { to: "telegram:@ops" },
        toolContext: { currentChannelId: "C12345678", currentChannelProvider: "slack" },
      }),
    ).not.toThrow();
  });

  it("blocks same-provider cross-context when disabled", () => {
    const cfg = {
      ...slackConfig,
      tools: { message: { crossContext: { allowWithinProvider: false } } },
    } as OpenClawConfig;

    expect(() =>
      enforceCrossContextPolicy({
        cfg,
        channel: "slack",
        action: "send",
        args: { to: "C99999999" },
        toolContext: { currentChannelId: "C12345678", currentChannelProvider: "slack" },
      }),
    ).toThrow(/Cross-context messaging denied/);
  });
});

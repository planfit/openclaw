import { describe, expect, it } from "vitest";
import { extractThreadIdFromSessionKey } from "./session-key-utils.js";

describe("extractThreadIdFromSessionKey", () => {
  it("extracts thread ID from :thread: marker", () => {
    expect(
      extractThreadIdFromSessionKey(
        "agent:main:slack:channel:c0ad56w375g:thread:1770906236.804979",
      ),
    ).toBe("1770906236.804979");
  });

  it("extracts thread ID from :topic: marker", () => {
    expect(
      extractThreadIdFromSessionKey("agent:main:discord:channel:abc123:topic:9876543210"),
    ).toBe("9876543210");
  });

  it("returns null when no thread marker is present", () => {
    expect(extractThreadIdFromSessionKey("agent:main:slack:channel:c0ad56w375g")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractThreadIdFromSessionKey("")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(extractThreadIdFromSessionKey(null)).toBeNull();
    expect(extractThreadIdFromSessionKey(undefined)).toBeNull();
  });

  it("returns null when thread marker has no trailing value", () => {
    expect(
      extractThreadIdFromSessionKey("agent:main:slack:channel:c0ad56w375g:thread:"),
    ).toBeNull();
  });
});

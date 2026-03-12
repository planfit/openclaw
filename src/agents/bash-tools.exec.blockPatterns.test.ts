import { describe, expect, it, vi } from "vitest";
import type { ExecApprovalsResolved } from "../infra/exec-approvals.js";

vi.mock("../infra/exec-approvals.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../infra/exec-approvals.js")>();
  const approvals: ExecApprovalsResolved = {
    path: "/tmp/exec-approvals.json",
    socketPath: "/tmp/exec-approvals.sock",
    token: "token",
    defaults: {
      security: "full",
      ask: "off",
      askFallback: "full",
      autoAllowSkills: false,
    },
    agent: {
      security: "full",
      ask: "off",
      askFallback: "full",
      autoAllowSkills: false,
    },
    allowlist: [],
    file: {
      version: 1,
      socket: { path: "/tmp/exec-approvals.sock", token: "token" },
      defaults: {
        security: "full",
        ask: "off",
        askFallback: "full",
        autoAllowSkills: false,
      },
      agents: {},
    },
  };
  return { ...mod, resolveExecApprovals: () => approvals };
});

describe("exec blockPatterns", () => {
  it("blocks command matching pattern", async () => {
    const { createExecTool } = await import("./bash-tools.exec.js");

    const tool = createExecTool({
      host: "gateway",
      security: "full",
      ask: "off",
      blockPatterns: [
        {
          pattern: "dangerous-command",
          message: "This command is blocked for safety.",
        },
      ],
    });

    await expect(tool.execute("call1", { command: "dangerous-command --arg" })).rejects.toThrow(
      "This command is blocked for safety.",
    );
  });

  it("allows command with unless exception", async () => {
    const { createExecTool } = await import("./bash-tools.exec.js");

    const tool = createExecTool({
      host: "gateway",
      security: "full",
      ask: "off",
      blockPatterns: [
        {
          pattern: "echo test",
          unless: "--safe",
          message: "Must use --safe flag.",
        },
      ],
    });

    const result = await tool.execute("call1", { command: "echo test --safe" });
    expect(result.details.status).toBe("completed");
  });

  it("uses default message when custom message not provided", async () => {
    const { createExecTool } = await import("./bash-tools.exec.js");

    const tool = createExecTool({
      host: "gateway",
      security: "full",
      ask: "off",
      blockPatterns: [
        {
          pattern: "rm -rf",
        },
      ],
    });

    await expect(tool.execute("call1", { command: "rm -rf /tmp/test" })).rejects.toThrow(
      'Command blocked: matches pattern "rm -rf"',
    );
  });

  it("allows command when no patterns match", async () => {
    const { createExecTool } = await import("./bash-tools.exec.js");

    const tool = createExecTool({
      host: "gateway",
      security: "full",
      ask: "off",
      blockPatterns: [
        {
          pattern: "dangerous-command",
          message: "This command is blocked.",
        },
      ],
    });

    const result = await tool.execute("call1", { command: "echo hello" });
    expect(result.details.status).toBe("completed");
  });

  it("blocks when pattern matches but unless does not", async () => {
    const { createExecTool } = await import("./bash-tools.exec.js");

    const tool = createExecTool({
      host: "gateway",
      security: "full",
      ask: "off",
      blockPatterns: [
        {
          pattern: "dangerous-operation",
          unless: "--confirm",
          message: "Must use --confirm flag.",
        },
      ],
    });

    await expect(
      tool.execute("call1", { command: "dangerous-operation --other-flag" }),
    ).rejects.toThrow("Must use --confirm flag.");
  });

  it("works with multiple patterns", async () => {
    const { createExecTool } = await import("./bash-tools.exec.js");

    const tool = createExecTool({
      host: "gateway",
      security: "full",
      ask: "off",
      blockPatterns: [
        {
          pattern: "command-a",
          unless: "--safe",
          message: "command-a requires --safe.",
        },
        {
          pattern: "command-b",
          message: "command-b is blocked.",
        },
        {
          pattern: "command-c",
          message: "command-c is blocked.",
        },
      ],
    });

    await expect(tool.execute("call1", { command: "command-b test" })).rejects.toThrow(
      "command-b is blocked.",
    );

    await expect(tool.execute("call2", { command: "command-c test" })).rejects.toThrow(
      "command-c is blocked.",
    );

    await expect(tool.execute("call3", { command: "command-a test" })).rejects.toThrow(
      "command-a requires --safe.",
    );

    const result = await tool.execute("call4", { command: "echo hello" });
    expect(result.details.status).toBe("completed");
  });

  it("does not block when blockPatterns is undefined", async () => {
    const { createExecTool } = await import("./bash-tools.exec.js");

    const tool = createExecTool({
      host: "gateway",
      security: "full",
      ask: "off",
    });

    const result = await tool.execute("call1", { command: "echo hello" });
    expect(result.details.status).toBe("completed");
  });

  it("does not block when blockPatterns is empty array", async () => {
    const { createExecTool } = await import("./bash-tools.exec.js");

    const tool = createExecTool({
      host: "gateway",
      security: "full",
      ask: "off",
      blockPatterns: [],
    });

    const result = await tool.execute("call1", { command: "echo hello" });
    expect(result.details.status).toBe("completed");
  });
});

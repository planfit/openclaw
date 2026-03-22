import { createEditTool, createWriteTool } from "@mariozechner/pi-coding-agent";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AnyAgentTool } from "./pi-tools.types.js";
import { wrapFilePathBlockGuard } from "./pi-tools.read.js";

describe("fileTools.blockPaths", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "blockpaths-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("blocks write to a blocked path", async () => {
    const base = createWriteTool(tempDir) as unknown as AnyAgentTool;
    const tool = wrapFilePathBlockGuard(
      base,
      [
        {
          pattern: "sensitive",
          message: "Cannot write to sensitive files.",
        },
      ],
      tempDir,
    );

    await expect(tool.execute("call1", { path: "sensitive.txt", content: "test" })).rejects.toThrow(
      "Cannot write to sensitive files.",
    );
  });

  it("blocks edit to a blocked path", async () => {
    const testFile = path.join(tempDir, "sensitive-data.txt");
    await fs.writeFile(testFile, "original content");

    const base = createEditTool(tempDir) as unknown as AnyAgentTool;
    const tool = wrapFilePathBlockGuard(
      base,
      [
        {
          pattern: "sensitive",
          message: "Cannot edit sensitive files.",
        },
      ],
      tempDir,
    );

    await expect(
      tool.execute("call1", {
        path: "sensitive-data.txt",
        oldText: "original",
        newText: "modified",
      }),
    ).rejects.toThrow("Cannot edit sensitive files.");
  });

  it("allows write to non-blocked paths", async () => {
    const base = createWriteTool(tempDir) as unknown as AnyAgentTool;
    const tool = wrapFilePathBlockGuard(
      base,
      [
        {
          pattern: "sensitive",
          message: "Cannot write to sensitive files.",
        },
      ],
      tempDir,
    );

    await tool.execute("call1", { path: "allowed.txt", content: "test content" });

    const content = await fs.readFile(path.join(tempDir, "allowed.txt"), "utf-8");
    expect(content).toBe("test content");
  });

  it("allows edit to non-blocked paths", async () => {
    const testFile = path.join(tempDir, "allowed.txt");
    await fs.writeFile(testFile, "original content");

    const base = createEditTool(tempDir) as unknown as AnyAgentTool;
    const tool = wrapFilePathBlockGuard(
      base,
      [
        {
          pattern: "sensitive",
          message: "Cannot edit sensitive files.",
        },
      ],
      tempDir,
    );

    await tool.execute("call1", {
      path: "allowed.txt",
      oldText: "original",
      newText: "modified",
    });

    const content = await fs.readFile(testFile, "utf-8");
    expect(content).toBe("modified content");
  });

  it("uses default message when custom message not provided", async () => {
    const base = createWriteTool(tempDir) as unknown as AnyAgentTool;
    const tool = wrapFilePathBlockGuard(
      base,
      [
        {
          pattern: ".env",
        },
      ],
      tempDir,
    );

    await expect(tool.execute("call1", { path: ".env", content: "SECRET=value" })).rejects.toThrow(
      'File path blocked: matches pattern ".env"',
    );
  });

  it("works with multiple patterns", async () => {
    const base = createWriteTool(tempDir) as unknown as AnyAgentTool;
    const tool = wrapFilePathBlockGuard(
      base,
      [
        {
          pattern: ".env",
          message: ".env files are blocked.",
        },
        {
          pattern: "credentials",
          message: "Credential files are blocked.",
        },
        {
          pattern: "secret",
          message: "Secret files are blocked.",
        },
      ],
      tempDir,
    );

    await expect(tool.execute("call1", { path: ".env", content: "test" })).rejects.toThrow(
      ".env files are blocked.",
    );

    await expect(
      tool.execute("call2", { path: "credentials.json", content: "test" }),
    ).rejects.toThrow("Credential files are blocked.");

    await expect(
      tool.execute("call3", { path: "secret-key.txt", content: "test" }),
    ).rejects.toThrow("Secret files are blocked.");

    await tool.execute("call4", { path: "allowed.txt", content: "test" });
    const content = await fs.readFile(path.join(tempDir, "allowed.txt"), "utf-8");
    expect(content).toBe("test");
  });

  it("does not block when blockPaths is undefined", async () => {
    const base = createWriteTool(tempDir) as unknown as AnyAgentTool;
    const tool = wrapFilePathBlockGuard(base, undefined, tempDir);

    await tool.execute("call1", { path: "any-file.txt", content: "test" });
    const content = await fs.readFile(path.join(tempDir, "any-file.txt"), "utf-8");
    expect(content).toBe("test");
  });

  it("does not block when blockPaths is empty array", async () => {
    const base = createWriteTool(tempDir) as unknown as AnyAgentTool;
    const tool = wrapFilePathBlockGuard(base, [], tempDir);

    await tool.execute("call1", { path: "any-file.txt", content: "test" });
    const content = await fs.readFile(path.join(tempDir, "any-file.txt"), "utf-8");
    expect(content).toBe("test");
  });

  it("matches against resolved absolute path", async () => {
    const base = createWriteTool(tempDir) as unknown as AnyAgentTool;
    const tool = wrapFilePathBlockGuard(
      base,
      [
        {
          pattern: path.join(tempDir, "blocked"),
          message: "This path is blocked.",
        },
      ],
      tempDir,
    );

    // Using relative path should still match when resolved
    await expect(
      tool.execute("call1", { path: "blocked/file.txt", content: "test" }),
    ).rejects.toThrow("This path is blocked.");

    // Using absolute path should also match
    await expect(
      tool.execute("call2", { path: path.join(tempDir, "blocked/file.txt"), content: "test" }),
    ).rejects.toThrow("This path is blocked.");
  });

  it("uses substring matching", async () => {
    const base = createWriteTool(tempDir) as unknown as AnyAgentTool;
    const tool = wrapFilePathBlockGuard(
      base,
      [
        {
          pattern: "config",
          message: "Config files are protected.",
        },
      ],
      tempDir,
    );

    // Should match any path containing "config"
    await expect(tool.execute("call1", { path: "config.json", content: "test" })).rejects.toThrow(
      "Config files are protected.",
    );

    await expect(
      tool.execute("call2", { path: "app-config.yaml", content: "test" }),
    ).rejects.toThrow("Config files are protected.");

    await expect(
      tool.execute("call3", { path: "configs/database.json", content: "test" }),
    ).rejects.toThrow("Config files are protected.");
  });
});

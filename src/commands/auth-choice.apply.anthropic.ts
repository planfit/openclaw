import type { ApplyAuthChoiceParams, ApplyAuthChoiceResult } from "./auth-choice.apply.js";
import { upsertAuthProfile } from "../agents/auth-profiles.js";
import { readClaudeCliCredentials } from "../agents/cli-credentials.js";
import {
  formatApiKeyPreview,
  normalizeApiKeyInput,
  validateApiKeyInput,
} from "./auth-choice.api-key.js";
import { buildTokenProfileId, validateAnthropicSetupToken } from "./auth-token.js";
import { applyAuthProfileConfig, setAnthropicApiKey } from "./onboard-auth.js";

async function isClaudeCliAvailable(): Promise<boolean> {
  try {
    const { runExec } = await import("../process/exec.js");
    const { stdout } = await runExec("claude", ["--version"]);
    return Boolean(stdout.trim());
  } catch {
    return false;
  }
}

export async function applyAuthChoiceAnthropic(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  if (params.authChoice === "claude-cli") {
    let nextConfig = params.config;
    const available = await isClaudeCliAvailable();
    if (!available) {
      await params.prompter.note(
        [
          "Claude CLI not found on PATH.",
          "Install it with: npm install -g @anthropic-ai/claude-code",
          "Then run: claude auth login",
        ].join("\n"),
        "Claude CLI not found",
      );
      return null;
    }

    // Read OAuth credentials from Claude CLI (~/.claude/.credentials.json or keychain)
    const cliCred = readClaudeCliCredentials();
    if (!cliCred) {
      await params.prompter.note(
        [
          "Claude CLI is installed but not authenticated.",
          "Run `claude auth login` first, then retry.",
        ].join("\n"),
        "Claude CLI not authenticated",
      );
      return null;
    }

    // Store the CLI credential in OpenClaw's auth-profiles
    if (cliCred.type === "oauth") {
      upsertAuthProfile({
        profileId: "anthropic:claude-cli",
        agentDir: params.agentDir,
        credential: {
          type: "oauth",
          provider: "anthropic",
          access: cliCred.access,
          refresh: cliCred.refresh,
          expires: cliCred.expires,
        },
      });
    } else {
      upsertAuthProfile({
        profileId: "anthropic:claude-cli",
        agentDir: params.agentDir,
        credential: {
          type: "token",
          provider: "anthropic",
          token: cliCred.token,
        },
      });
    }

    await params.prompter.note(
      [
        "Claude CLI credentials imported successfully.",
        `Auth type: ${cliCred.type}`,
        cliCred.type === "oauth" ? `Expires: ${new Date(cliCred.expires).toLocaleString()}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      "Anthropic Claude CLI",
    );

    nextConfig = applyAuthProfileConfig(nextConfig, {
      profileId: "anthropic:claude-cli",
      provider: "anthropic",
      mode: "cli",
    });
    // Set default model to claude-cli provider
    nextConfig = {
      ...nextConfig,
      agents: {
        ...nextConfig.agents,
        defaults: {
          ...nextConfig.agents?.defaults,
          model: {
            ...(typeof nextConfig.agents?.defaults?.model === "object"
              ? nextConfig.agents.defaults.model
              : undefined),
            primary: "claude-cli/claude-sonnet-4-6",
          },
        },
      },
    };
    return { config: nextConfig };
  }

  if (
    params.authChoice === "setup-token" ||
    params.authChoice === "oauth" ||
    params.authChoice === "token"
  ) {
    let nextConfig = params.config;
    await params.prompter.note(
      ["Run `claude setup-token` in your terminal.", "Then paste the generated token below."].join(
        "\n",
      ),
      "Anthropic setup-token",
    );

    const tokenRaw = await params.prompter.text({
      message: "Paste Anthropic setup-token",
      validate: (value) => validateAnthropicSetupToken(String(value ?? "")),
    });
    const token = String(tokenRaw).trim();

    const profileNameRaw = await params.prompter.text({
      message: "Token name (blank = default)",
      placeholder: "default",
    });
    const provider = "anthropic";
    const namedProfileId = buildTokenProfileId({
      provider,
      name: String(profileNameRaw ?? ""),
    });

    upsertAuthProfile({
      profileId: namedProfileId,
      agentDir: params.agentDir,
      credential: {
        type: "token",
        provider,
        token,
      },
    });

    nextConfig = applyAuthProfileConfig(nextConfig, {
      profileId: namedProfileId,
      provider,
      mode: "token",
    });
    return { config: nextConfig };
  }

  if (params.authChoice === "apiKey") {
    if (params.opts?.tokenProvider && params.opts.tokenProvider !== "anthropic") {
      return null;
    }

    let nextConfig = params.config;
    let hasCredential = false;
    const envKey = process.env.ANTHROPIC_API_KEY?.trim();

    if (params.opts?.token) {
      await setAnthropicApiKey(normalizeApiKeyInput(params.opts.token), params.agentDir);
      hasCredential = true;
    }

    if (!hasCredential && envKey) {
      const useExisting = await params.prompter.confirm({
        message: `Use existing ANTHROPIC_API_KEY (env, ${formatApiKeyPreview(envKey)})?`,
        initialValue: true,
      });
      if (useExisting) {
        await setAnthropicApiKey(envKey, params.agentDir);
        hasCredential = true;
      }
    }
    if (!hasCredential) {
      const key = await params.prompter.text({
        message: "Enter Anthropic API key",
        validate: validateApiKeyInput,
      });
      await setAnthropicApiKey(normalizeApiKeyInput(String(key)), params.agentDir);
    }
    nextConfig = applyAuthProfileConfig(nextConfig, {
      profileId: "anthropic:default",
      provider: "anthropic",
      mode: "api_key",
    });
    return { config: nextConfig };
  }

  return null;
}

import type { ModelDefinitionConfig } from "openclaw/plugin-sdk/provider-catalog-shared";
import { BEDROCK_MANTLE_REGIONS, type BedrockMantleRegion } from "./index.js";

const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MAX_TOKENS = 4096;

export interface BedrockMantleModel {
  id: string;
  object: string;
  created?: number;
  owned_by?: string;
}

export interface BedrockMantleModelsResponse {
  object: string;
  data: BedrockMantleModel[];
}

export interface BedrockMantleDiscoveryOptions {
  bearerToken: string;
  region?: BedrockMantleRegion;
  timeout?: number;
}

function resolveBedrockMantleRegion(region?: string): BedrockMantleRegion {
  if (region && BEDROCK_MANTLE_REGIONS.includes(region as BedrockMantleRegion)) {
    return region as BedrockMantleRegion;
  }

  // Default to us-east-1 if no region or invalid region
  return "us-east-1";
}

function buildBedrockMantleBaseUrl(region: BedrockMantleRegion): string {
  return `https://bedrock-mantle.${region}.api.aws/v1`;
}

export async function discoverBedrockMantleModels(
  options: BedrockMantleDiscoveryOptions,
): Promise<ModelDefinitionConfig[]> {
  const region = resolveBedrockMantleRegion(options.region);
  const baseUrl = buildBedrockMantleBaseUrl(region);
  const modelsUrl = `${baseUrl}/models`;

  const timeout = options.timeout ?? 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(modelsUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${options.bearerToken}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `Failed to discover Bedrock Mantle models: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as BedrockMantleModelsResponse;

    if (!data.data || !Array.isArray(data.data)) {
      throw new Error("Invalid response from Bedrock Mantle models endpoint");
    }

    // Convert OpenAI-format models to OpenClaw format
    return data.data.map((model) => ({
      id: model.id,
      name: model.id,
      api: "openai-completions" as const,
      providerId: "amazon-bedrock-mantle",
      baseUrl,
      auth: "api-key" as const,
      apiKeySource: "env:AWS_BEARER_TOKEN_BEDROCK",
      reasoning: false,
      input: ["text"],
      contextWindow: DEFAULT_CONTEXT_WINDOW,
      maxTokens: DEFAULT_MAX_TOKENS,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
      },
    }));
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Bedrock Mantle discovery timeout after ${timeout}ms`);
    }

    throw error;
  }
}

export function resolveBearerTokenFromEnv(): string | undefined {
  return process.env.AWS_BEARER_TOKEN_BEDROCK;
}

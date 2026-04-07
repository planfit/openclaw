import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import type { ModelDefinitionConfig } from "openclaw/plugin-sdk/provider-catalog-shared";
import {
  discoverBedrockMantleModels,
  resolveBearerTokenFromEnv,
  BEDROCK_MANTLE_REGIONS,
} from "./discovery.js";

const PROVIDER_ID = "amazon-bedrock-mantle";

export default function registerProvider(api: OpenClawPluginApi): void {
  // Register implicit provider resolution
  api.providers.registerImplicitProviderResolver({
    id: `${PROVIDER_ID}:implicit`,

    async resolveImplicitConfig(): Promise<ModelDefinitionConfig[] | undefined> {
      const bearerToken = resolveBearerTokenFromEnv();

      if (!bearerToken) {
        // No token available, skip implicit registration
        return undefined;
      }

      try {
        // Try to discover models with the bearer token
        const models = await discoverBedrockMantleModels({
          bearerToken,
          timeout: 10000, // 10 second timeout for implicit discovery
        });

        if (models.length === 0) {
          return undefined;
        }

        // Return discovered models
        return models;
      } catch (error) {
        // Discovery failed, skip implicit registration
        console.debug(
          `Bedrock Mantle implicit discovery failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        return undefined;
      }
    },
  });

  // Register provider catalog
  api.providers.registerProviderCatalog({
    providerId: PROVIDER_ID,
    name: "Amazon Bedrock Mantle",
    description: "OpenAI-compatible API for Amazon Bedrock",

    async getAvailableModels(): Promise<ModelDefinitionConfig[]> {
      const bearerToken = resolveBearerTokenFromEnv();

      if (!bearerToken) {
        throw new Error(
          "AWS_BEARER_TOKEN_BEDROCK environment variable not set. " +
            "Please set it with your Bedrock API key or SigV4-derived token.",
        );
      }

      const models = await discoverBedrockMantleModels({
        bearerToken,
        timeout: 30000,
      });

      if (models.length === 0) {
        throw new Error("No models discovered from Bedrock Mantle endpoint");
      }

      return models;
    },
  });

  // Register error classifier for rate limits and context overflow
  api.providers.registerProviderErrorClassifier({
    providerId: PROVIDER_ID,

    classifyError(error: unknown): string | undefined {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorString = errorMessage.toLowerCase();

      // Rate limit detection
      if (
        errorString.includes("rate limit") ||
        errorString.includes("too many requests") ||
        errorString.includes("429")
      ) {
        return "rate-limit";
      }

      // Context overflow detection
      if (
        (errorString.includes("context") && errorString.includes("too long")) ||
        (errorString.includes("context") && errorString.includes("overflow")) ||
        errorString.includes("maximum context") ||
        errorString.includes("token limit")
      ) {
        return "context-overflow";
      }

      // Auth errors
      if (
        errorString.includes("401") ||
        errorString.includes("unauthorized") ||
        errorString.includes("authentication") ||
        errorString.includes("invalid token")
      ) {
        return "auth-error";
      }

      return undefined;
    },
  });
}

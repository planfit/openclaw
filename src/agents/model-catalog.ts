import fs from "node:fs";
import path from "node:path";
import { type OpenClawConfig, loadConfig } from "../config/config.js";
import { resolveOpenClawAgentDir } from "./agent-paths.js";
import { ensureOpenClawModelsJson } from "./models-config.js";

export type ModelCatalogEntry = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: Array<"text" | "image">;
};

type DiscoveredModel = {
  id: string;
  name?: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: Array<"text" | "image">;
};

type PiSdkModule = typeof import("./pi-model-discovery.js");

let modelCatalogPromise: Promise<ModelCatalogEntry[]> | null = null;
let hasLoggedModelCatalogError = false;
const defaultImportPiSdk = () => import("./pi-model-discovery.js");
let importPiSdk = defaultImportPiSdk;

export function resetModelCatalogCacheForTest() {
  modelCatalogPromise = null;
  hasLoggedModelCatalogError = false;
  importPiSdk = defaultImportPiSdk;
}

// Test-only escape hatch: allow mocking the dynamic import to simulate transient failures.
export function __setModelCatalogImportForTest(loader?: () => Promise<PiSdkModule>) {
  importPiSdk = loader ?? defaultImportPiSdk;
}

export async function loadModelCatalog(params?: {
  config?: OpenClawConfig;
  useCache?: boolean;
}): Promise<ModelCatalogEntry[]> {
  if (params?.useCache === false) {
    modelCatalogPromise = null;
  }
  if (modelCatalogPromise) {
    return modelCatalogPromise;
  }

  modelCatalogPromise = (async () => {
    const models: ModelCatalogEntry[] = [];
    const sortModels = (entries: ModelCatalogEntry[]) =>
      entries.sort((a, b) => {
        const p = a.provider.localeCompare(b.provider);
        if (p !== 0) {
          return p;
        }
        return a.name.localeCompare(b.name);
      });
    try {
      const cfg = params?.config ?? loadConfig();
      await ensureOpenClawModelsJson(cfg);
      // IMPORTANT: keep the dynamic import *inside* the try/catch.
      // If this fails once (e.g. during a pnpm install that temporarily swaps node_modules),
      // we must not poison the cache with a rejected promise (otherwise all channel handlers
      // will keep failing until restart).
      const piSdk = await importPiSdk();
      const agentDir = resolveOpenClawAgentDir();
      // Ensure auth.json includes credentials from auth-profiles and env vars
      // so pi-sdk can discover models for authenticated providers.
      await ensureAuthJsonForDiscovery(agentDir);
      const authStorage = new piSdk.AuthStorage(path.join(agentDir, "auth.json"));
      const registry = new piSdk.ModelRegistry(authStorage, path.join(agentDir, "models.json")) as
        | {
            getAll: () => Array<DiscoveredModel>;
          }
        | Array<DiscoveredModel>;
      const entries = Array.isArray(registry) ? registry : registry.getAll();
      for (const entry of entries) {
        const id = String(entry?.id ?? "").trim();
        if (!id) {
          continue;
        }
        const provider = String(entry?.provider ?? "").trim();
        if (!provider) {
          continue;
        }
        const name = String(entry?.name ?? id).trim() || id;
        const contextWindow =
          typeof entry?.contextWindow === "number" && entry.contextWindow > 0
            ? entry.contextWindow
            : undefined;
        const reasoning = typeof entry?.reasoning === "boolean" ? entry.reasoning : undefined;
        const input = Array.isArray(entry?.input) ? entry.input : undefined;
        models.push({ id, name, provider, contextWindow, reasoning, input });
      }

      if (models.length === 0) {
        // If we found nothing, don't cache this result so we can try again.
        modelCatalogPromise = null;
      }

      return sortModels(models);
    } catch (error) {
      if (!hasLoggedModelCatalogError) {
        hasLoggedModelCatalogError = true;
        console.warn(`[model-catalog] Failed to load model catalog: ${String(error)}`);
      }
      // Don't poison the cache on transient dependency/filesystem issues.
      modelCatalogPromise = null;
      if (models.length > 0) {
        return sortModels(models);
      }
      return [];
    }
  })();

  return modelCatalogPromise;
}

/**
 * Ensure auth.json contains credentials from auth-profiles.json and env vars.
 * pi-sdk's ModelRegistry hides providers when auth.json lacks a matching entry,
 * so we mirror credentials here so model discovery sees all authenticated providers.
 */
async function ensureAuthJsonForDiscovery(agentDir: string): Promise<void> {
  const authJsonPath = path.join(agentDir, "auth.json");
  const credentials: Record<string, { type: string; key?: string }> = {};

  // 1. Read from auth-profiles.json
  try {
    const profilesPath = path.join(agentDir, "auth-profiles.json");
    if (fs.existsSync(profilesPath)) {
      const raw = JSON.parse(fs.readFileSync(profilesPath, "utf8")) as Record<string, unknown>;
      const profiles = (raw.profiles ?? raw) as Record<
        string,
        { provider?: string; type?: string; key?: string; token?: string }
      >;
      for (const cred of Object.values(profiles)) {
        const provider = cred.provider?.trim();
        if (!provider || credentials[provider]) {
          continue;
        }
        if (cred.type === "api_key" && cred.key?.trim()) {
          credentials[provider] = { type: "api_key", key: cred.key.trim() };
        }
        // Note: setup-tokens (type: "token") are NOT added here.
        // They are bearer tokens for subscription auth, not API keys,
        // and writing them as api_key causes auth failures downstream.
      }
    }
  } catch {
    // ignore
  }

  // 2. Fill from env vars for known providers
  const envProviders: [string, string[]][] = [
    ["anthropic", ["ANTHROPIC_OAUTH_TOKEN", "ANTHROPIC_API_KEY"]],
    ["openai", ["OPENAI_API_KEY"]],
    ["google", ["GEMINI_API_KEY", "GOOGLE_API_KEY"]],
    ["xai", ["XAI_API_KEY"]],
    ["openrouter", ["OPENROUTER_API_KEY"]],
  ];
  for (const [provider, envVars] of envProviders) {
    if (credentials[provider]) {
      continue;
    }
    for (const envVar of envVars) {
      const value = process.env[envVar]?.trim();
      if (value) {
        credentials[provider] = { type: "api_key", key: value };
        break;
      }
    }
  }

  if (Object.keys(credentials).length === 0) {
    return;
  }

  // 3. Write/merge auth.json
  let existing: Record<string, unknown> = {};
  try {
    if (fs.existsSync(authJsonPath)) {
      existing = JSON.parse(fs.readFileSync(authJsonPath, "utf8")) as Record<string, unknown>;
    }
  } catch {
    // ignore
  }

  const merged = { ...existing, ...credentials };
  const next = JSON.stringify(merged, null, 2) + "\n";
  const prev = fs.existsSync(authJsonPath) ? fs.readFileSync(authJsonPath, "utf8") : "";
  if (next !== prev) {
    fs.mkdirSync(agentDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(authJsonPath, next, { mode: 0o600 });
  }
}

/**
 * Check if a model supports image input based on its catalog entry.
 */
export function modelSupportsVision(entry: ModelCatalogEntry | undefined): boolean {
  return entry?.input?.includes("image") ?? false;
}

/**
 * Find a model in the catalog by provider and model ID.
 */
export function findModelInCatalog(
  catalog: ModelCatalogEntry[],
  provider: string,
  modelId: string,
): ModelCatalogEntry | undefined {
  const normalizedProvider = provider.toLowerCase().trim();
  const normalizedModelId = modelId.toLowerCase().trim();
  return catalog.find(
    (entry) =>
      entry.provider.toLowerCase() === normalizedProvider &&
      entry.id.toLowerCase() === normalizedModelId,
  );
}

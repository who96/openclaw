import type { OpenClawConfig } from "../config/config.js";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "./defaults.js";
import { loadModelCatalog, type ModelCatalogEntry } from "./model-catalog.js";
import {
  buildModelAliasIndex,
  modelKey,
  parseModelRef,
  resolveConfiguredModelRef,
  resolveModelRefFromString,
  type ModelAliasIndex,
} from "./model-selection.js";

export type ResolvedConfiguredModelEntry = {
  key: string;
  ref: { provider: string; model: string };
  tags: Set<string>;
  aliases: string[];
};

export type ResolvedModelViewEntry = {
  key: string;
  provider: string;
  model: string;
  name: string;
  contextWindow?: number;
  maxTokens?: number;
  reasoning?: boolean;
  aliases: string[];
  tags: Set<string>;
  inCatalog: boolean;
};

function buildConfiguredEntries(params: {
  cfg: OpenClawConfig;
  aliasIndex: ModelAliasIndex;
  resolvedDefault: { provider: string; model: string };
}): ResolvedConfiguredModelEntry[] {
  const order: string[] = [];
  const tagsByKey = new Map<string, Set<string>>();
  const aliasesByKey = new Map<string, string[]>();

  for (const [key, aliases] of params.aliasIndex.byKey.entries()) {
    aliasesByKey.set(key, aliases);
  }

  const addEntry = (ref: { provider: string; model: string }, tag: string) => {
    const key = modelKey(ref.provider, ref.model);
    if (!tagsByKey.has(key)) {
      tagsByKey.set(key, new Set());
      order.push(key);
    }
    tagsByKey.get(key)?.add(tag);
  };

  addEntry(params.resolvedDefault, "default");

  const modelConfig = params.cfg.agents?.defaults?.model as
    | { primary?: string; fallbacks?: string[] }
    | undefined;
  const imageModelConfig = params.cfg.agents?.defaults?.imageModel as
    | { primary?: string; fallbacks?: string[] }
    | undefined;
  const modelFallbacks = typeof modelConfig === "object" ? (modelConfig?.fallbacks ?? []) : [];
  const imageFallbacks =
    typeof imageModelConfig === "object" ? (imageModelConfig?.fallbacks ?? []) : [];
  const imagePrimary = imageModelConfig?.primary?.trim() ?? "";

  const addRawEntry = (raw: string, tag: string) => {
    const resolved = resolveModelRefFromString({
      raw,
      defaultProvider: DEFAULT_PROVIDER,
      aliasIndex: params.aliasIndex,
    });
    if (!resolved) {
      return;
    }
    addEntry(resolved.ref, tag);
  };

  modelFallbacks.forEach((raw, idx) => {
    addRawEntry(String(raw ?? ""), `fallback#${idx + 1}`);
  });

  if (imagePrimary) {
    addRawEntry(imagePrimary, "image");
  }

  imageFallbacks.forEach((raw, idx) => {
    addRawEntry(String(raw ?? ""), `img-fallback#${idx + 1}`);
  });

  for (const key of Object.keys(params.cfg.agents?.defaults?.models ?? {})) {
    const parsed = parseModelRef(String(key ?? ""), DEFAULT_PROVIDER);
    if (!parsed) {
      continue;
    }
    addEntry(parsed, "configured");
  }

  return order.map((key) => {
    const slash = key.indexOf("/");
    const provider = slash === -1 ? key : key.slice(0, slash);
    const model = slash === -1 ? "" : key.slice(slash + 1);
    return {
      key,
      ref: { provider, model },
      tags: new Set(tagsByKey.get(key) ?? []),
      aliases: aliasesByKey.get(key) ?? [],
    } satisfies ResolvedConfiguredModelEntry;
  });
}

export function resolveConfiguredEntries(cfg: OpenClawConfig): {
  resolvedDefault: { provider: string; model: string };
  aliasIndex: ModelAliasIndex;
  entries: ResolvedConfiguredModelEntry[];
} {
  const resolvedDefault = resolveConfiguredModelRef({
    cfg,
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL,
  });
  const aliasIndex = buildModelAliasIndex({
    cfg,
    defaultProvider: DEFAULT_PROVIDER,
  });

  return {
    resolvedDefault,
    aliasIndex,
    entries: buildConfiguredEntries({
      cfg,
      aliasIndex,
      resolvedDefault,
    }),
  };
}

export async function loadResolvedModelView(params: {
  cfg: OpenClawConfig;
  includeAllCatalog?: boolean;
  useCache?: boolean;
}): Promise<{
  allowAny: boolean;
  aliasIndex: ModelAliasIndex;
  catalog: ModelCatalogEntry[];
  configuredEntries: ResolvedConfiguredModelEntry[];
  resolvedDefault: { provider: string; model: string };
  visibleCatalog: ModelCatalogEntry[];
  visibleEntries: ResolvedModelViewEntry[];
  visibleKeys: Set<string>;
}> {
  const {
    resolvedDefault,
    aliasIndex,
    entries: configuredEntries,
  } = resolveConfiguredEntries(params.cfg);
  const catalog = await loadModelCatalog({
    config: params.cfg,
    useCache: params.useCache,
  });
  const allowAny = Object.keys(params.cfg.agents?.defaults?.models ?? {}).length === 0;
  const configuredKeys = new Set(configuredEntries.map((entry) => entry.key));
  const visibleCatalog =
    allowAny || params.includeAllCatalog
      ? catalog
      : catalog.filter((entry) => configuredKeys.has(modelKey(entry.provider, entry.id)));
  const configuredByKey = new Map(configuredEntries.map((entry) => [entry.key, entry]));
  const visibleByKey = new Map<string, ResolvedModelViewEntry>();

  for (const entry of visibleCatalog) {
    const key = modelKey(entry.provider, entry.id);
    const configured = configuredByKey.get(key);
    visibleByKey.set(key, {
      key,
      provider: entry.provider,
      model: entry.id,
      name: entry.name,
      contextWindow: entry.contextWindow,
      maxTokens: entry.maxTokens,
      reasoning: entry.reasoning,
      aliases: configured?.aliases ?? aliasIndex.byKey.get(key) ?? [],
      tags: new Set(configured?.tags ?? []),
      inCatalog: true,
    });
  }

  for (const entry of configuredEntries) {
    if (visibleByKey.has(entry.key)) {
      continue;
    }
    visibleByKey.set(entry.key, {
      key: entry.key,
      provider: entry.ref.provider,
      model: entry.ref.model,
      name: entry.ref.model,
      aliases: entry.aliases,
      tags: new Set(entry.tags),
      inCatalog: false,
    });
  }

  const visibleEntries = [...visibleByKey.values()].toSorted((a, b) => {
    const providerOrder = a.provider.localeCompare(b.provider);
    if (providerOrder !== 0) {
      return providerOrder;
    }
    return a.model.localeCompare(b.model);
  });
  const visibleKeys = new Set(visibleEntries.map((entry) => entry.key));

  return {
    allowAny,
    aliasIndex,
    catalog,
    configuredEntries,
    resolvedDefault,
    visibleCatalog,
    visibleEntries,
    visibleKeys,
  };
}

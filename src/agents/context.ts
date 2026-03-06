// Lazy-load pi-coding-agent model metadata so we can infer context windows when
// the agent reports a model id. This includes custom models.json entries.

import { loadConfig } from "../config/config.js";
import { loadResolvedModelView } from "./resolved-model-view.js";

const MODEL_CACHE = new Map<string, number>();
const loadPromise = (async () => {
  try {
    const cfg = loadConfig();
    const { visibleEntries } = await loadResolvedModelView({
      cfg,
      includeAllCatalog: true,
    });
    for (const entry of visibleEntries) {
      if (!entry?.model) {
        continue;
      }
      if (typeof entry.contextWindow === "number" && entry.contextWindow > 0) {
        MODEL_CACHE.set(entry.key, entry.contextWindow);
        MODEL_CACHE.set(entry.model, entry.contextWindow);
      }
    }
  } catch {
    // If pi-ai isn't available, leave cache empty; lookup will fall back.
  }
})();

export function lookupContextTokens(modelId?: string): number | undefined {
  if (!modelId) {
    return undefined;
  }
  // Best-effort: kick off loading, but don't block.
  void loadPromise;
  return MODEL_CACHE.get(modelId);
}

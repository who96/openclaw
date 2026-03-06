import type { OpenClawConfig } from "../../config/config.js";
import type { ConfiguredEntry } from "./list.types.js";
import {
  resolveConfiguredEntries as resolveConfiguredEntriesShared,
  type ResolvedConfiguredModelEntry,
} from "../../agents/resolved-model-view.js";

export function resolveConfiguredEntries(cfg: OpenClawConfig) {
  const entries = resolveConfiguredEntriesShared(cfg).entries.map(
    (entry: ResolvedConfiguredModelEntry) =>
      ({
        key: entry.key,
        ref: entry.ref,
        tags: entry.tags,
        aliases: entry.aliases,
      }) satisfies ConfiguredEntry,
  );

  return { entries };
}

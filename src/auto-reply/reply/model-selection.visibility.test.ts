import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { createModelSelectionState } from "./model-selection.js";

const loadModelCatalog = vi.hoisted(() => vi.fn());

vi.mock("../../agents/model-catalog.js", () => ({
  loadModelCatalog,
}));

describe("createModelSelectionState visibility", () => {
  it("keeps config-only allowlisted models in the visible key set", async () => {
    loadModelCatalog.mockResolvedValue([
      {
        provider: "anthropic",
        id: "claude-opus-4-5",
        name: "Claude Opus 4.5",
      },
    ]);

    const cfg = {
      agents: {
        defaults: {
          model: { primary: "anthropic/claude-opus-4-5" },
          models: {
            "openai-codex/gpt-5.4": {},
          },
        },
      },
    } as OpenClawConfig;

    const state = await createModelSelectionState({
      cfg,
      agentCfg: cfg.agents?.defaults,
      defaultProvider: "anthropic",
      defaultModel: "claude-opus-4-5",
      provider: "anthropic",
      model: "claude-opus-4-5",
      hasModelDirective: true,
    });

    expect(state.allowedModelKeys.has("openai-codex/gpt-5.4")).toBe(true);
    expect(state.allowedModelCatalog).toEqual([
      {
        provider: "anthropic",
        id: "claude-opus-4-5",
        name: "Claude Opus 4.5",
      },
    ]);
  });
});

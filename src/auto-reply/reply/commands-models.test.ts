import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { resolveModelsCommandReply } from "./commands-models.js";

const loadModelCatalog = vi.hoisted(() => vi.fn());

vi.mock("../../agents/model-catalog.js", () => ({
  loadModelCatalog,
}));

describe("resolveModelsCommandReply", () => {
  it("lists config-only models that are missing from the catalog", async () => {
    loadModelCatalog.mockResolvedValue([
      {
        provider: "anthropic",
        id: "claude-opus-4-5",
        name: "Claude Opus 4.5",
      },
      {
        provider: "openai-codex",
        id: "gpt-5.3-codex",
        name: "GPT-5.3 Codex",
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

    const reply = await resolveModelsCommandReply({
      cfg,
      commandBodyNormalized: "/models openai-codex",
    });

    expect(reply?.text).toContain("openai-codex/gpt-5.4");
  });
});

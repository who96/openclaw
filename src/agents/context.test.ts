import { beforeEach, describe, expect, it, vi } from "vitest";

const loadConfig = vi.fn();
const loadResolvedModelView = vi.fn();
const discoverAuthStorage = vi.fn();
const discoverModels = vi.fn();
const ensureOpenClawModelsJson = vi.fn();

vi.mock("../config/config.js", () => ({
  loadConfig,
}));

vi.mock("./resolved-model-view.js", () => ({
  loadResolvedModelView,
}));

vi.mock("./pi-model-discovery.js", () => ({
  discoverAuthStorage,
  discoverModels,
}));

vi.mock("./models-config.js", () => ({
  ensureOpenClawModelsJson,
}));

vi.mock("./agent-paths.js", () => ({
  resolveOpenClawAgentDir: vi.fn(() => "/tmp/openclaw-agent"),
}));

describe("lookupContextTokens", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    loadConfig.mockReturnValue({});
    loadResolvedModelView.mockResolvedValue({
      visibleEntries: [
        {
          key: "openai/catalog-only",
          provider: "openai",
          model: "catalog-only",
          name: "Catalog Only",
          contextWindow: 999,
          aliases: [],
          tags: new Set(),
          inCatalog: true,
        },
      ],
    });
    discoverAuthStorage.mockReturnValue({ mocked: true });
    discoverModels.mockReturnValue({
      getAll: () => [{ id: "catalog-only", contextWindow: 123 }],
    });
    ensureOpenClawModelsJson.mockResolvedValue(undefined);
  });

  it("loads metadata from the resolved model view instead of scanning the raw registry", async () => {
    const { lookupContextTokens } = await import("./context.js");

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(loadResolvedModelView).toHaveBeenCalledWith(
      expect.objectContaining({
        cfg: {},
        includeAllCatalog: true,
      }),
    );
    expect(discoverModels).not.toHaveBeenCalled();
    expect(lookupContextTokens("catalog-only")).toBe(999);
  });
});

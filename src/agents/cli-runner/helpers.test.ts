import { beforeEach, describe, expect, it, vi } from "vitest";

const buildAgentSystemPrompt = vi.fn(() => "prompt");
const buildModelAliasLines = vi.fn(() => ["- Shared sentinel"]);
const buildSystemPromptParams = vi.fn(() => ({
  runtimeInfo: "runtime-info",
  userTimezone: "Asia/Shanghai",
  userTime: "2026-03-07 00:00",
  userTimeFormat: "24" as const,
}));

vi.mock("../../tts/tts.js", () => ({
  buildTtsSystemPromptHint: vi.fn(() => undefined),
}));

vi.mock("../model-selection.js", () => ({
  resolveDefaultModelForAgent: vi.fn(() => ({
    provider: "anthropic",
    model: "claude-sonnet-4-5",
  })),
}));

vi.mock("../resolved-model-view.js", () => ({
  buildModelAliasLines,
}));

vi.mock("../shell-utils.js", () => ({
  detectRuntimeShell: vi.fn(() => "/bin/zsh"),
}));

vi.mock("../system-prompt-params.js", () => ({
  buildSystemPromptParams,
}));

vi.mock("../system-prompt.js", () => ({
  buildAgentSystemPrompt,
}));

describe("buildSystemPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildAgentSystemPrompt.mockReturnValue("prompt");
    buildModelAliasLines.mockReturnValue(["- Shared sentinel"]);
  });

  it("uses the shared alias-line helper", async () => {
    const { buildSystemPrompt } = await import("./helpers.js");
    const config = {
      agents: {
        defaults: {
          models: {
            "anthropic/claude-opus-4-5": { alias: "Opus" },
          },
        },
      },
    };

    const prompt = buildSystemPrompt({
      workspaceDir: "/tmp/openclaw",
      config,
      tools: [],
      modelDisplay: "anthropic/claude-sonnet-4-5",
    });

    expect(prompt).toBe("prompt");
    expect(buildModelAliasLines).toHaveBeenCalledWith(config);
    expect(buildAgentSystemPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        modelAliasLines: ["- Shared sentinel"],
      }),
    );
  });
});

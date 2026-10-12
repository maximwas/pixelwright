import { note } from "@clack/prompts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SetupCancelled } from "../src/cli/cancel.ts";
import { addToClaudeCode } from "../src/cli/clients.ts";
import { runWizard } from "../src/cli/wizard.ts";

// The prompts are a terminal UI: they are replaced here with recorders, so the test sees what the person would.
const prompts = vi.hoisted(() => ({
  CANCEL: Symbol("cancel"),
  spinner: {
    start: vi.fn(),
    stop: vi.fn(),
    error: vi.fn(),
    cancel: vi.fn(),
    message: vi.fn(),
    clear: vi.fn(),
    isCancelled: false,
  },
  log: {
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
  multiselect: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  log: prompts.log,
  spinner: () => prompts.spinner,
  multiselect: prompts.multiselect,
  confirm: prompts.confirm,
  isCancel: (value: unknown) => value === prompts.CANCEL,
}));

vi.mock("../src/cli/clients.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/cli/clients.ts")>()),
  detectClients: () => [],
  addToClaudeCode: vi.fn(),
}));

vi.mock("../src/cli/plugin-files.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/cli/plugin-files.ts")>()),
  packagedPlugin: () => null,
}));

const places = {
  home: "/nowhere",
  pluginHome: "/nowhere/.pixelwright/plugin",
};

describe("the setup wizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prompts.multiselect.mockResolvedValue(["claude-code"]);
  });

  it("stops its spinner when Claude Code cannot be added, and goes on to the end", async () => {
    vi.mocked(addToClaudeCode).mockRejectedValue(new Error("claude mcp add failed: boom"));

    await runWizard(places);

    // Nothing was added, so there is nothing to restart.
    expect(vi.mocked(note).mock.calls.at(-1)?.[0]).not.toContain("Restart");
    expect(prompts.spinner.start).toHaveBeenCalled();
    expect(prompts.spinner.error).toHaveBeenCalledWith("claude mcp add failed: boom");
  });

  it("says what Claude Code kept after asking whether to replace its entry", async () => {
    vi.mocked(addToClaudeCode).mockImplementation(async (_server, replace) =>
      (await replace()) ? "Added to Claude Code for every folder." : "Claude Code keeps the Pixelwright it had.",
    );
    prompts.confirm.mockResolvedValue(false);

    await runWizard(places);

    expect(prompts.log.success).toHaveBeenCalledWith("Claude Code keeps the Pixelwright it had.");
  });

  it("stops the whole setup on Ctrl+C at a client's question", async () => {
    vi.mocked(addToClaudeCode).mockImplementation(async (_server, replace) => {
      await replace();

      return "Added to Claude Code for every folder.";
    });
    prompts.confirm.mockResolvedValue(prompts.CANCEL);

    await expect(runWizard(places)).rejects.toBeInstanceOf(SetupCancelled);
  });
});

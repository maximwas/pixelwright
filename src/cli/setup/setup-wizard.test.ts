import { mkdtempSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { McpClients } from "@/cli/setup/mcp-clients.ts";
import type { McpClient } from "@/cli/setup/setup.types.ts";
import { SetupWizard } from "@/cli/setup/setup-wizard.ts";
import type { ProcessResult, ProcessRunner } from "@/core/ports/process-runner.port.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";

/** The user's real home, from the system's user database: HOME itself may point anywhere. */
const REAL_HOME = userInfo().homedir;

/**
 * A temp HOME and an empty PATH (m:c75e45d9: a test once reached the real `claude` and replaced the user's own
 * registration): whatever slips past the fake runner finds no binary, and a home inside the real one throws at once.
 */
function safeHome(): string {
  const home = mkdtempSync(join(tmpdir(), "pixelwright-cli-"));

  if (home.startsWith(REAL_HOME)) {
    throw new Error(`refusing a test home inside the real home: ${home}`);
  }

  vi.stubEnv("HOME", home);
  vi.stubEnv("PATH", "");
  vi.stubEnv("PIXELWRIGHT_HOME", "");

  return home;
}

/** A runner that records each command and answers in turn: it never starts a process. */
function fakeRunner(...answers: Partial<ProcessResult>[]) {
  const calls: string[] = [];
  const runner: ProcessRunner = {
    run: async (command, args) => {
      calls.push([command, ...args].join(" "));

      return { code: 0, stdout: "", stderr: "", ...answers[calls.length - 1] };
    },
  };

  return { calls, runner };
}

const NPX = { command: "npx", args: ["-y", "pixelwright@latest"] };

const CANCEL = Symbol("cancel");

/** The prompts as recorders, so the test sees what the person would; Claude Code is the one client picked. */
function terminal(confirmAnswer: boolean | symbol) {
  const spinner = { start: vi.fn(), stop: vi.fn(), error: vi.fn() };

  return {
    spinner,
    prompts: {
      intro: vi.fn(),
      outro: vi.fn(),
      note: vi.fn(),
      cancel: vi.fn(),
      log: { success: vi.fn(), error: vi.fn(), warn: vi.fn() },
      spinner: () => spinner,
      multiselect: vi.fn(async (): Promise<McpClient[] | symbol> => ["claude-code"]),
      confirm: vi.fn(async (): Promise<boolean | symbol> => confirmAnswer),
      isCancel: (value: unknown): value is symbol => value === CANCEL,
    },
  };
}

/** The wizard over a temp home, the runner's answers and a package without a built plugin. */
function wizard(runner: ProcessRunner, confirmAnswer: boolean | symbol = true) {
  const userHome = safeHome();
  const settings = {
    userHome,
    pluginHome: join(userHome, CHANNEL.home, "plugin"),
    platform: "darwin" as const,
    invocation: NPX,
  };
  const shown = terminal(confirmAnswer);
  const noPlugin = { packaged: () => null, install: async () => "" };

  return { ...shown, wizard: new SetupWizard(shown.prompts, new McpClients(runner, settings), noPlugin, settings) };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("SetupWizard", () => {
  it("stops its spinner when Claude Code cannot be added, and goes on to the end (S-061)", async () => {
    const { prompts, spinner, wizard: setup } = wizard(fakeRunner({}, { code: 1, stderr: "boom" }).runner);

    expect(await setup.run()).toBe(0);
    expect(spinner.start).toHaveBeenCalled();
    expect(spinner.error).toHaveBeenCalledWith("claude mcp add failed: boom");
    // Nothing was added, so there is nothing to restart.
    expect(prompts.note.mock.calls.at(-1)?.[0]).not.toContain("Restart");
    expect(prompts.outro).toHaveBeenCalled();
  });

  it("says what Claude Code kept after asking whether to replace its entry", async () => {
    const { prompts, wizard: setup } = wizard(fakeRunner({}, { code: 1, stderr: "already exists" }).runner, false);

    await setup.run();

    expect(prompts.log.success).toHaveBeenCalledWith(`Claude Code keeps the ${CHANNEL.name} it had.`);
  });

  it("stops the whole setup on Ctrl+C at a client's question: nothing after it runs, and it exits 1", async () => {
    // `claude --version` first: the wizard ticks the clients it finds.
    const { calls, runner } = fakeRunner({}, { code: 1, stderr: "already exists" });
    const { prompts, wizard: setup } = wizard(runner, CANCEL);

    expect(await setup.run()).toBe(1);
    expect(prompts.cancel).toHaveBeenCalledWith("Setup cancelled.");
    expect(calls).toEqual([
      "claude --version",
      `claude mcp add ${CHANNEL.name} --scope user -- npx -y pixelwright@latest`,
    ]);
    expect(prompts.outro).not.toHaveBeenCalled();
  });
});

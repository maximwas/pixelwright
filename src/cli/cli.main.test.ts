import { mkdtempSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CliMain } from "@/cli/cli.main.ts";
import { COMMAND } from "@/cli/main/cli.constants.ts";
import { CLI_COMMANDS, LOGS_SETTINGS, SETUP_SETTINGS } from "@/cli/main/cli.tokens.ts";
import { COMMAND_LINE, CommandLine } from "@/cli/main/command-line.ts";
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

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("CliMain", () => {
  it("resolves every command, and puts the plugin and the log under the channel's home, never 0.7.0's", () => {
    const home = safeHome();
    const container = new CliMain().container();
    const channelHome = join(home, CHANNEL.home);

    expect(container.get(COMMAND_LINE)).toBeInstanceOf(CommandLine);
    expect(
      container
        .get(CLI_COMMANDS, { multi: true })
        .map((command) => command.name)
        .sort(),
    ).toEqual([COMMAND.logs, COMMAND.serve, COMMAND.setup, COMMAND.setupPrint].sort());
    expect(container.get(SETUP_SETTINGS).pluginHome).toBe(join(channelHome, "plugin"));
    expect(container.get(LOGS_SETTINGS).file.startsWith(channelHome)).toBe(true);
  });
});

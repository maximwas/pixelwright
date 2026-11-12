import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { McpClients } from "@/cli/setup/mcp-clients.ts";
import { PluginCopy } from "@/cli/setup/plugin-copy.ts";
import { SetupPrint } from "@/cli/setup/setup-print.ts";
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

/** A built plugin as the package carries it: the manifest naming this channel's plugin, main and the window. */
function fakePlugin(): string {
  const from = mkdtempSync(join(tmpdir(), "pixelwright-plugin-src-"));

  writeFileSync(join(from, "manifest.json"), JSON.stringify({ name: CHANNEL.pluginName }));
  writeFileSync(join(from, "main.js"), "main");
  writeFileSync(join(from, "ui.html"), "ui");

  return from;
}

const NPX = { command: "npx", args: ["-y", "pixelwright@latest"] };

/** setup --print over a temp home, with the plugin source given (or none); it never runs a command. */
function print(from: string | null) {
  const userHome = safeHome();
  const pluginHome = join(userHome, CHANNEL.home, "plugin");
  const settings = { userHome, pluginHome, platform: "darwin" as const, invocation: NPX };
  const refuse = {
    run: async () => {
      throw new Error("setup --print runs no command");
    },
  };
  const written = { stdout: "" };
  const stdout = { write: (text: string) => (written.stdout += text) };
  const copy = { packaged: () => from, install: (source: string, to: string) => new PluginCopy().install(source, to) };

  return {
    pluginHome,
    written,
    print: new SetupPrint(new McpClients(refuse, settings), copy, settings, { stdin: {}, stdout, stderr: stdout }),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("SetupPrint", () => {
  it("puts the plugin where the path it prints says, and prints every client's way in (S-064)", async () => {
    const { pluginHome, written, print: setup } = print(fakePlugin());

    expect(await setup.run()).toBe(0);
    expect(existsSync(join(pluginHome, "manifest.json"))).toBe(true);
    expect(written.stdout).toContain(join(pluginHome, "manifest.json"));
    expect(written.stdout).toContain(`claude mcp add ${CHANNEL.name} --scope user -- npx -y pixelwright@latest`);
    expect(written.stdout).toContain(`"${CHANNEL.name}"`);
    expect(written.stdout).toContain(`[mcp_servers.${CHANNEL.name}]`);
  });

  it("says where the plugin comes from when this copy has none", async () => {
    const { written, print: setup } = print(null);

    await setup.run();

    expect(written.stdout).toContain("npx -y pixelwright@latest setup --print");
    expect(written.stdout).not.toContain("manifest.json");
  });
});

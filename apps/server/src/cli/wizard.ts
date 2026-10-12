import { join } from "node:path";
import { confirm, intro, log, multiselect, note, outro, spinner } from "@clack/prompts";
import { CODEX_CONFIG_PATH, MCP_CLIENTS, SERVER_INVOCATION } from "../constants/clients.ts";
import type { McpClient } from "../types/cli.ts";
import { errorMessage } from "../utils/error-message.ts";
import { claudeCodeInvocation } from "../utils/server-invocation.ts";
import { answered, SetupCancelled } from "./cancel.ts";
import { addToClaudeCode, addToCursor, clientConfigBlock, codexBlock, detectClients } from "./clients.ts";
import { installPlugin, packagedPlugin } from "./plugin-files.ts";

/**
 * The setup, `npx pixelwright` in a terminal: which MCP clients get the server, the Figma plugin's files put where
 * Figma Desktop can import them, and what to do in Figma. Every step can be skipped; Ctrl+C stops it where it is.
 */
export async function runWizard({ home, pluginHome }: { home: string; pluginHome: string }): Promise<void> {
  intro("Pixelwright: AI agents that read and edit your Figma files");

  const clients = await chooseClients(home);
  let connected = 0;

  for (const client of clients) {
    if (await connectClient(client, home)) {
      connected += 1;
    }
  }

  const manifest = await placePlugin(pluginHome);

  note(
    [
      ...(manifest === null
        ? []
        : [`1. Figma Desktop → Plugins → Development → Import plugin from manifest… → ${manifest}`]),
      `${manifest === null ? 1 : 2}. Open your file and run Plugins → Development → Pixelwright; keep its window open.`,
      `${manifest === null ? 2 : 3}. The first time, your agent shows a pairing code: type it into that window.`,
      `${manifest === null ? 3 : 4}. Turn on Allow edits there when the agent should change the file.`,
      "",
      connected === 0 ? "" : "Restart your MCP client so it loads Pixelwright.",
    ]
      .filter((line, index, lines) => line !== "" || index < lines.length - 1)
      .join("\n"),
    "Next, in Figma",
  );
  outro("Done.");
}

async function chooseClients(home: string): Promise<McpClient[]> {
  const found = detectClients(home);

  return answered(
    await multiselect({
      message: "Where should Pixelwright be available? (space to pick, enter to go on)",
      options: MCP_CLIENTS.map(({ value, label }) => ({
        value,
        label,
        ...(found.includes(value) ? { hint: "found on this computer" } : {}),
      })),
      initialValues: found,
      required: false,
    }),
  );
}

/** One client; false when it could not be set up (said why). Ctrl+C in its questions stops the whole setup. */
async function connectClient(client: McpClient, home: string): Promise<boolean> {
  try {
    switch (client) {
      case "claude-code":
        return await connectClaudeCode();
      case "cursor":
        log.success(
          await addToCursor(SERVER_INVOCATION, home, async () =>
            answered(await confirm({ message: "Cursor has another Pixelwright set up. Replace it with this one?" })),
          ),
        );

        return true;
      case "codex":
        note(codexBlock(SERVER_INVOCATION), `Add to ${join(home, ...CODEX_CONFIG_PATH)}`);

        return true;
      case "other":
        note(clientConfigBlock(SERVER_INVOCATION), "Add to your MCP client's config");

        return true;
    }
  } catch (error) {
    if (error instanceof SetupCancelled) {
      throw error;
    }

    log.error(errorMessage(error));

    return false;
  }
}

/** Claude Code, through its claude command. The spinner stops on every path: a running one would keep the setup open. */
async function connectClaudeCode(): Promise<boolean> {
  const working = spinner();
  let spinning = true;

  working.start("Adding to Claude Code…");

  try {
    const outcome = await addToClaudeCode(claudeCodeInvocation(SERVER_INVOCATION, process.platform), async () => {
      spinning = false;
      working.stop("Claude Code has Pixelwright already.");

      return answered(await confirm({ message: "Replace it with this one?" }));
    });

    if (spinning) {
      working.stop(outcome);
    } else {
      log.success(outcome);
    }

    return true;
  } catch (error) {
    if (!spinning) {
      throw error;
    }

    working.error(errorMessage(error));

    return false;
  }
}

/** The plugin's files copied to the Pixelwright folder, when the person wants them; the manifest's path, or null. */
async function placePlugin(pluginHome: string): Promise<string | null> {
  const from = packagedPlugin();

  if (from === null) {
    log.warn("This copy of Pixelwright has no built Figma plugin: install pixelwright from npm to get it.");

    return null;
  }

  const wanted = answered(
    await confirm({
      message: `Put the Figma plugin in ${pluginHome}, where Figma Desktop can import it?`,
      initialValue: true,
    }),
  );

  if (!wanted) {
    return null;
  }

  try {
    const manifest = await installPlugin(from, pluginHome);

    log.success(`The Figma plugin is in ${pluginHome}.`);

    return manifest;
  } catch (error) {
    log.error(errorMessage(error));

    return null;
  }
}

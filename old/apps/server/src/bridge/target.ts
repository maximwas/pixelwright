import { BridgeError } from "@pixelwright/core";
import type { ConnectedPlugin } from "../types/bridge.ts";

/**
 * The plugin session a tool works on: the active file when none is named, else the file named by session id or by
 * name (case-insensitive). A name two files share, or one no file has, fails with the files that are connected.
 */
export function resolveTarget(plugins: readonly ConnectedPlugin[], file?: string): { session: string } {
  if (plugins.length === 0) {
    throw new BridgeError(
      "PLUGIN_NOT_CONNECTED",
      "No Figma file is connected: run the Pixelwright plugin in Figma Desktop and keep its window open.",
    );
  }

  if (file === undefined) {
    const active = plugins.find((plugin) => plugin.active) ?? plugins[0];

    return { session: active?.session ?? "" };
  }

  const bySession = plugins.find((plugin) => plugin.session === file);

  if (bySession !== undefined) {
    return { session: bySession.session };
  }

  const wanted = file.trim().toLowerCase();
  const byName = plugins.filter((plugin) => plugin.info.file.name.toLowerCase() === wanted);
  const [only] = byName;

  if (byName.length === 1 && only !== undefined) {
    return { session: only.session };
  }

  if (byName.length > 1) {
    throw new BridgeError(
      "AMBIGUOUS_FILE",
      `Several connected files are named ${file}: sessions ${byName.map((plugin) => plugin.session).join(", ")}. Pass the session from status as file.`,
    );
  }

  throw new BridgeError(
    "FILE_NOT_FOUND",
    `No connected file is named ${file}. Connected: ${plugins.map((plugin) => plugin.info.file.name).join(", ")}.`,
  );
}

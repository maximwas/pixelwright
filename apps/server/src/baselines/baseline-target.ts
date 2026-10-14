import { type BaselineFile, BridgeError } from "@pixelwright/core";
import { resolveTarget } from "../bridge/target.ts";
import type { ConnectedPlugin } from "../types/bridge.ts";

/**
 * The connected file a baseline is compared in: the one `file` names (with a note when it is not the file the baseline
 * came from), else that file, found by its key, else by its name. Node ids repeat across files, so never the active
 * file by default.
 */
export function baselineTarget(
  plugins: readonly ConnectedPlugin[],
  baseline: Pick<BaselineFile, "file">,
  file: string | undefined,
): { session: string; notes: string[] } {
  if (file !== undefined) {
    const { session } = resolveTarget(plugins, file);
    const connected = plugins.find((plugin) => plugin.session === session)?.info.file;
    const differs =
      connected !== undefined && (connected.name !== baseline.file.name || connected.key !== baseline.file.key);

    return {
      session,
      notes: differs ? [`Compared in ${connected.name}, not ${baseline.file.name}, which the baseline came from.`] : [],
    };
  }

  if (plugins.length === 0) {
    resolveTarget(plugins);
  }

  return {
    session: sessionOf(plugins, baseline.file),
    notes: [],
  };
}

function sessionOf(plugins: readonly ConnectedPlugin[], { name, key }: BaselineFile["file"]): string {
  if (key !== null) {
    const byKey = plugins.find((plugin) => plugin.info.file.key === key);

    if (byKey === undefined) {
      throw new BridgeError(
        "FILE_NOT_FOUND",
        `${name} (key ${key}) is not connected: open it in Figma Desktop with the Pixelwright plugin; a copy shares the name, not the key.`,
      );
    }

    return byKey.session;
  }

  const byName = plugins.filter((plugin) => plugin.info.file.name === name);

  if (byName.length > 1) {
    throw new BridgeError(
      "AMBIGUOUS_FILE",
      `Several connected files are named ${name}: sessions ${byName.map((plugin) => plugin.session).join(", ")}. Pass file (a session from status).`,
    );
  }

  const [only] = byName;

  if (only === undefined) {
    throw new BridgeError(
      "FILE_NOT_FOUND",
      `${name} is not connected: open ${name} in Figma Desktop with the Pixelwright plugin, or pass file if it was renamed.`,
    );
  }

  return only.session;
}

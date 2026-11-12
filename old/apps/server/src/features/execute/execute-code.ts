import type * as z from "zod";
import { REQUEST_TIMEOUT_MS } from "../../constants/bridge.ts";
import { versionBefore } from "../../history/version-before.ts";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import { codeToRun } from "./code-to-run.ts";
import { EXECUTE_ANSWER_MARGIN_MS, READS_ONLY_NOTE } from "./constants.ts";
import { readsOnly } from "./reads-only.ts";
import type { ExecuteInputSchema, ExecuteOutputSchema } from "./schemas.ts";
import { syntaxError } from "./syntax-error.ts";

type ExecuteArgs = z.output<typeof ExecuteInputSchema>;

/**
 * The code (or the script's) run in the plugin of one file, a named version saved first when one is asked for. The
 * server waits for the answer a little past the code's own time, however long that is, and never less than the
 * bridge's usual wait. A relative script starts from `root`, the project folder.
 */
export async function executeCode(
  plugin: PluginClient,
  { timeout, file, version: title, ...source }: ExecuteArgs,
  root = process.cwd(),
): Promise<z.input<typeof ExecuteOutputSchema>> {
  const code = await codeToRun(source, root);
  const invalid = syntaxError(code);

  if (invalid !== null) {
    return {
      result: null,
      logs: [],
      error: invalid,
    };
  }

  const session = plugin.session(file);
  const version = await versionBefore(session, {
    title,
    dryRun: false,
  });
  const timeoutMs = Math.round(timeout * 1_000);
  const ran = await session.run(
    "execute",
    {
      code,
      timeoutMs,
    },
    { timeoutMs: Math.max(REQUEST_TIMEOUT_MS, timeoutMs + EXECUTE_ANSWER_MARGIN_MS) },
  );

  return {
    ...ran,
    // Decided from the code, not from Figma's change events: a file in a background tab hears of them a minute late.
    ...(ran.error === undefined && readsOnly(code) ? { note: READS_ONLY_NOTE } : {}),
    ...(version === undefined ? {} : { version }),
  };
}

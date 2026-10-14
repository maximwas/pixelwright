import { type OperationResult, tokensPlan } from "@pixelwright/core";
import type * as z from "zod";
import { versionBefore } from "../../history/version-before.ts";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import type { TokensApplyOutputSchema, TokensApplyToolInputSchema } from "./schemas.ts";

type TokensApplyArgs = z.output<typeof TokensApplyToolInputSchema>;
type TokensApplied = z.input<typeof TokensApplyOutputSchema>;
type Written = OperationResult<"tokens_apply">;

/**
 * tokens_apply: the values read in core, written by the plugin; what core could not read comes first among errors.
 * A version is saved only before a write that changes something: with a title, a dry run first says whether one will.
 */
export async function applyTokens(
  plugin: PluginClient,
  { dryRun, file, version: title, ...input }: TokensApplyArgs,
): Promise<TokensApplied> {
  const { plan, errors } = tokensPlan(input);
  // The check, the version and the write go to one file, whatever comes to the front meanwhile.
  const session = plugin.session(file);
  const write = (dry: boolean) =>
    session.run("tokens_apply", {
      plan,
      dryRun: dry,
    });
  const probe = title === undefined || dryRun ? null : await write(true);

  if (probe !== null && probe.created.length + probe.updated.length === 0) {
    // The file holds every token already: nothing to write, so no version to save before it.
    return answer(probe, errors, false);
  }

  const version = await versionBefore(session, {
    title,
    dryRun,
  });

  return {
    ...answer(await write(dryRun), errors, dryRun),
    ...(version === undefined ? {} : { version }),
  };
}

/** The plugin's answer with core's errors first. */
function answer(written: Written, errors: Written["errors"], dryRun: boolean): TokensApplied {
  return {
    ...written,
    errors: [...errors, ...written.errors],
    dryRun,
  };
}

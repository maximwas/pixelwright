import { tokensPlan } from "@pixelwright/core";
import type * as z from "zod";
import { versionBefore } from "../../history/version-before.ts";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import type { TokensApplyOutputSchema, TokensApplyToolInputSchema } from "./schemas.ts";

type TokensApplyArgs = z.output<typeof TokensApplyToolInputSchema>;
type TokensApplied = z.input<typeof TokensApplyOutputSchema>;

/** tokens_apply: the values read in core, written by the plugin; what core could not read comes first among errors. */
export async function applyTokens(
  plugin: PluginClient,
  { dryRun, file, version: title, ...input }: TokensApplyArgs,
): Promise<TokensApplied> {
  const { plan, errors } = tokensPlan(input);
  const version = await versionBefore(plugin, {
    title,
    dryRun,
    file,
  });
  const applied = await plugin.run(
    "tokens_apply",
    {
      plan,
      dryRun,
    },
    file,
  );

  return {
    ...applied,
    errors: [...errors, ...applied.errors],
    dryRun,
    ...(version === undefined ? {} : { version }),
  };
}

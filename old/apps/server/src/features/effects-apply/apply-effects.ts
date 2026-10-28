import type * as z from "zod";
import { versionedWrite } from "../../history/versioned-write.ts";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import { effectsOf } from "./resolve-effects.ts";
import type { EffectsApplyInputSchema, EffectsApplyOutputSchema } from "./schemas.ts";

type EffectsApplyArgs = z.output<typeof EffectsApplyInputSchema>;
type EffectsApplied = z.input<typeof EffectsApplyOutputSchema>;

/**
 * effects_apply: the call's effects resolved here, written by the plugin. A version is saved only before a write that
 * changes something: with a title, a dry run first says whether one will.
 */
export async function applyEffects(
  plugin: PluginClient,
  { dryRun, file, version: title, ...request }: EffectsApplyArgs,
): Promise<EffectsApplied> {
  const effects = effectsOf(request);
  // The check, the version and the write go to one file, whatever comes to the front meanwhile.
  const session = plugin.session(file);
  const write = (dry: boolean) =>
    session.run("effects", {
      nodes: request.nodes,
      ...effects,
      dryRun: dry,
    });
  const { result, version } = await versionedWrite(
    session,
    {
      title,
      dryRun,
    },
    {
      write,
      changes: (applied) => applied.changed.length,
    },
  );

  return {
    ...result,
    dryRun,
    ...(version === undefined ? {} : { version }),
  };
}

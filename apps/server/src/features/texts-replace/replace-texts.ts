import type { TextsOutput } from "@pixelwright/core";
import type * as z from "zod";
import { versionedWrite } from "../../history/versioned-write.ts";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import { scopeOf } from "../../plugin/scope.ts";
import { quantity } from "../../utils/quantity.ts";
import type { TextsReplaceInputSchema, TextsReplaceOutputSchema } from "./schemas.ts";

type TextsReplaceArgs = z.output<typeof TextsReplaceInputSchema>;
type TextsReplaced = z.input<typeof TextsReplaceOutputSchema>;

/**
 * texts_replace: the plugin makes the replacements in the texts under the scope. A version is saved only before a
 * write that changes something: with a title, a dry run first says whether one will.
 */
export async function replaceTexts(
  plugin: PluginClient,
  { within, replacements, dryRun, file, version: title }: TextsReplaceArgs,
): Promise<TextsReplaced> {
  const session = plugin.session(file);
  const scope = await scopeOf(session, within, { pageWhenEmpty: false });
  const write = (dry: boolean) =>
    session.run("texts", {
      roots: [...scope.roots],
      replacements,
      dryRun: dry,
    });
  const { result, dry, version } = await versionedWrite(
    session,
    {
      title,
      dryRun,
    },
    {
      write,
      changes: (replaced) => replaced.texts,
    },
  );

  return {
    ...result,
    summary: summaryOf(result, dry, scope.label),
    dryRun,
    ...(version === undefined ? {} : { version }),
  };
}

/** How many matches in how many texts were (or would be) replaced, and what stopped. */
function summaryOf(result: TextsOutput, dry: boolean, scope: string): string {
  const matches = quantity(result.count, "match", "matches");
  const texts = quantity(result.texts, "text");
  const parts = [
    `${dry ? "Would replace" : "Replaced"} ${matches} in ${texts} under ${scope}`,
    result.errors.length > 0 ? `${result.errors.length} left as they were (see errors)` : null,
    result.more ? "time ran out before every text: replace the rest with a narrower within" : null,
  ];

  return `${parts.filter((part) => part !== null).join("; ")}.`;
}

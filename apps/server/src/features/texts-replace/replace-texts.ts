import type { TextsOutput } from "@pixelwright/core";
import type * as z from "zod";
import { versionBefore } from "../../history/version-before.ts";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import { scopeOf } from "../../plugin/scope.ts";
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
  const probe = title === undefined || dryRun ? null : await write(true);

  if (probe !== null && probe.texts === 0) {
    return {
      ...probe,
      summary: summaryOf(probe, true, scope.label),
      dryRun: false,
    };
  }

  const version = await versionBefore(session, {
    title,
    dryRun,
  });
  const result = await write(dryRun);

  return {
    ...result,
    summary: summaryOf(result, dryRun, scope.label),
    dryRun,
    ...(version === undefined ? {} : { version }),
  };
}

/** How many matches in how many texts were (or would be) replaced, and what stopped. */
function summaryOf(result: TextsOutput, dry: boolean, scope: string): string {
  const matches = `${result.count} ${result.count === 1 ? "match" : "matches"}`;
  const texts = `${result.texts} text${result.texts === 1 ? "" : "s"}`;
  const parts = [
    `${dry ? "Would replace" : "Replaced"} ${matches} in ${texts} under ${scope}`,
    result.errors.length > 0 ? `${result.errors.length} left as they were (see errors)` : null,
    result.more ? "time ran out before every text: replace the rest with a narrower within" : null,
  ];

  return `${parts.filter((part) => part !== null).join("; ")}.`;
}

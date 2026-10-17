import type { BindOutput } from "@pixelwright/core";
import type * as z from "zod";
import { versionBefore } from "../../history/version-before.ts";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import { scopeOf } from "../../plugin/scope.ts";
import type { TokensBindInputSchema, TokensBindOutputSchema } from "./schemas.ts";

type TokensBindArgs = z.output<typeof TokensBindInputSchema>;
type TokensBound = z.input<typeof TokensBindOutputSchema>;

/**
 * tokens_bind: the plugin binds the raw values under the scope to the tokens holding them, or rebinds one token's uses
 * to another. A version is saved only before a write that changes something: with a title, a dry run first says
 * whether one will.
 */
export async function bindTokens(
  plugin: PluginClient,
  { within, dryRun, file, version: title, ...request }: TokensBindArgs,
): Promise<TokensBound> {
  // The scope, the check, the version and the write go to one file, whatever comes to the front meanwhile.
  const session = plugin.session(file);
  const scope = await scopeOf(session, within, { pageWhenEmpty: false });
  const write = (dry: boolean) =>
    session.run("bind", {
      ...request,
      roots: [...scope.roots],
      dryRun: dry,
    });
  const probe = title === undefined || dryRun ? null : await write(true);

  if (probe !== null && probe.layers === 0) {
    return {
      ...probe,
      summary: summaryOf(probe, true),
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
    summary: summaryOf(result, dryRun),
    dryRun,
    ...(version === undefined ? {} : { version }),
  };
}

/** "1 value has" or "3 values have", then the rest. */
function values(count: number, rest: string): string {
  return `${count} value${count === 1 ? " has" : "s have"} ${rest}`;
}

/** n thing(s). */
function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** What was bound (or would be), what waits for a pick and what no token holds, in one sentence. */
export function summaryOf(result: BindOutput, dry: boolean): string {
  const uses = (groups: readonly { count: number }[]) => groups.reduce((sum, group) => sum + group.count, 0);
  const done =
    result.remapped.length > 0
      ? `${dry ? "Would rebind" : "Rebound"} ${counted(uses(result.remapped), "use")}`
      : `${dry ? "Would bind" : "Bound"} ${counted(uses(result.bound), "raw value")} to tokens`;
  const parts = [
    `${done} on ${counted(result.layers, "layer")}`,
    result.ambiguous.length > 0 ? values(result.ambiguous.length, "several tokens: pick with choose") : null,
    result.unmatched.length > 0 ? values(result.unmatched.length, "no token") : null,
    result.errors.length > 0 ? counted(result.errors.length, "error") : null,
    result.more ? "time ran out before every layer: bind the rest with a narrower within" : null,
  ];

  return `${parts.filter((part) => part !== null).join("; ")}.`;
}

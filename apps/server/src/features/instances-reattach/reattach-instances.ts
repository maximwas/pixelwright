import type { InstancesOutput } from "@pixelwright/core";
import type * as z from "zod";
import { versionBefore } from "../../history/version-before.ts";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import { scopeOf } from "../../plugin/scope.ts";
import type { InstancesReattachInputSchema, InstancesReattachOutputSchema } from "./schemas.ts";

type ReattachArgs = z.output<typeof InstancesReattachInputSchema>;
type Reattached = z.input<typeof InstancesReattachOutputSchema>;

/** Layers an answer changed, or would. */
const changes = (result: InstancesOutput) => result.reattached.length + result.swapped.length + result.reset.length;

/**
 * instances_reattach: the plugin puts detached frames back, swaps and resets instances under the scope. A version is
 * saved only before a write that changes something: with a title, a dry run first says whether one will.
 */
export async function reattachInstances(
  plugin: PluginClient,
  { within, reattach, swap, reset, dryRun, file, version: title }: ReattachArgs,
): Promise<Reattached> {
  const session = plugin.session(file);
  const scope = await scopeOf(session, within, { pageWhenEmpty: false });
  const write = (dry: boolean) =>
    session.run("instances", {
      roots: [...scope.roots],
      reattach: reattach ?? (swap.length === 0 && reset === undefined),
      swap,
      ...(reset === undefined ? {} : { reset }),
      dryRun: dry,
    });
  const probe = title === undefined || dryRun ? null : await write(true);

  if (probe !== null && changes(probe) === 0) {
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

function summaryOf(result: InstancesOutput, dry: boolean): string {
  const counted = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
  const parts = [
    result.reattached.length > 0
      ? `${dry ? "would put" : "put"} ${counted(result.reattached.length, "detached frame")} back as ${result.reattached.length === 1 ? "an instance" : "instances"}`
      : null,
    result.swapped.length > 0
      ? `${dry ? "would swap" : "swapped"} ${counted(result.swapped.length, "instance")}`
      : null,
    result.reset.length > 0 ? `${dry ? "would reset" : "reset"} ${counted(result.reset.length, "instance")}` : null,
    result.errors.length > 0 ? `${counted(result.errors.length, "layer")} left (see errors)` : null,
    result.more ? "time ran out before every layer: run again with a narrower within" : null,
  ].filter((part) => part !== null);
  const sentence = parts.length === 0 ? "nothing to change here" : parts.join("; ");

  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

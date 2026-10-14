import type { ApplyChange, OperationInput, OperationOutput } from "@pixelwright/core";
import { TokenIndex } from "../../figma/tokens/token-index.ts";
import type { PluginServices } from "../../services/plugin-services.ts";
import { ApplyFonts } from "./apply-fonts.ts";
import { ApplyImages } from "./apply-images.ts";
import { ApplyRun } from "./apply-run.ts";
import { DryRunCheck } from "./dry-run-check.ts";
import { topLayer } from "./targets.ts";

/**
 * The `apply` operation: design_apply's changes written in Figma, each element on its own; one undo step for the call.
 * Refused while Allow edits is off; a dry run checks ids, parents, tokens and fonts and writes nothing. The files the
 * call uploaded are dropped once it is done.
 */
export async function applyChanges(
  { changes, parent, dryRun }: OperationInput<"apply">,
  services: PluginServices,
): Promise<OperationOutput<"apply">> {
  if (!dryRun) {
    services.edits.require();
  }

  try {
    const top = parent === undefined ? null : await topLayer(parent);
    const tokens = lazyTokens();
    const fonts = await ApplyFonts.prepare(changes, {
      dryRun,
      catalog: services.fonts,
      tokens,
    });

    return dryRun
      ? await new DryRunCheck(changes, {
          fonts,
          tokens,
        }).run()
      : await new ApplyRun(changes, {
          top,
          fonts,
          tokens,
          images: new ApplyImages(services.uploads),
        }).run();
  } finally {
    services.uploads.drop(changes.flatMap(streamsOf));
  }
}

/** The call's token index, built on first use: most calls name no token. */
function lazyTokens(): () => Promise<TokenIndex> {
  let index: Promise<TokenIndex> | null = null;

  return () => {
    index ??= TokenIndex.of();

    return index;
  };
}

/** The upload streams a change names: its asset's and its image paints'. */
function streamsOf(change: ApplyChange): string[] {
  const paints = [...(change.props.fills ?? []), ...(change.props.textFills ?? [])];

  return [
    change.props.asset?.stream,
    ...paints.map((paint) => (paint.kind === "image" ? paint.stream : undefined)),
  ].filter((stream): stream is string => stream !== undefined);
}

import { CurrentLayers, type LayerEntry, layerRead, type ReadTokens, styleMismatches } from "@pixelwright/core";
import type * as z from "zod";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import { NOT_GIVEN_NOTE } from "./constants.ts";
import type { StylesCompareInputSchema, StylesCompareOutputSchema } from "./schemas.ts";

type CompareArgs = z.output<typeof StylesCompareInputSchema>;
type Pair = CompareArgs["pairs"][number];
type Compared = z.input<typeof StylesCompareOutputSchema>;
type LayerCompared = Compared["layers"][number];

/**
 * styles_compare: the plugin reads the pairs' layers as design_apply reads the layers it writes (each with its parent
 * and the tokens), each is written as design_read writes it in its parent, and core holds the build's computed styles
 * against it.
 */
export async function compareStyles(plugin: PluginClient, { pairs, tolerance, file }: CompareArgs): Promise<Compared> {
  const session = plugin.session(file);
  const layers = CurrentLayers.of(await session.run("entries", { ids: [...new Set(pairs.map(({ node }) => node))] }));
  const compared: LayerCompared[] = [];
  const missing: string[] = [];
  const notes = new Set<string>();

  for (const pair of pairs) {
    const entry = layers.entry(pair.node);

    if (entry === undefined) {
      missing.push(pair.node);
    } else {
      compared.push(
        layerCompared(entry, layers.tokens, pair, {
          tolerance,
          notes,
        }),
      );
    }
  }

  const given = compared.every(({ notGiven }) => notGiven.length === 0);

  return {
    layers: compared,
    missing,
    same: given && missing.length === 0 && compared.every(({ mismatches }) => mismatches.length === 0),
    notes: [...notes, ...(given ? [] : [NOT_GIVEN_NOTE])],
  };
}

/** One layer's styles against the build's; a hidden layer as it shows when shown, as design_apply reads it. */
function layerCompared(
  { node, parent }: LayerEntry,
  tokens: ReadTokens,
  pair: Pair,
  { tolerance, notes }: { readonly tolerance: number; readonly notes: Set<string> },
): LayerCompared {
  const shown = node.visible
    ? node
    : {
        ...node,
        visible: true,
      };
  const { element, ...read } = layerRead(
    {
      node: shown,
      parent,
    },
    tokens,
  );

  if (!node.visible) {
    notes.add(`${node.name} (${node.id}) is hidden in the design: it is compared as it shows when shown.`);
  }

  if (element === null) {
    notes.add(`${node.name} (${node.id}) is drawn as part of an icon or an image: compare that one instead.`);
  }

  return {
    node: pair.node,
    name: node.name,
    tag: element?.tag ?? node.type,
    ...(pair.label === undefined ? {} : { label: pair.label }),
    ...(element === null
      ? {
          matched: 0,
          mismatches: [],
          notGiven: [],
          notCompared: [],
        }
      : styleMismatches(
          {
            attributes: element.attributes,
            ...read,
          },
          pair.css,
          { tolerance },
        )),
  };
}

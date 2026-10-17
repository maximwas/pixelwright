import type { BindCandidate, BindIndex, BindInput } from "@pixelwright/core";
import { opacitiesAgain } from "../../figma/paints.ts";
import { type BindContext, loadTextFonts } from "./bind-context.ts";
import type { BindReport } from "./bind-report.ts";

/** One token's uses to rebind to another, both found: as the call named them, and the style or variable each is. */
interface RemapPair {
  readonly from: string;
  readonly to: string;
  readonly source: BindCandidate;
  readonly target: BindCandidate;
}

/** What remapping a layer needs: the pair, the call's context, and whether it only counts. */
interface RemapRun {
  readonly pair: RemapPair;
  readonly context: BindContext;
  readonly dryRun: boolean;
}

type Fields = SceneNode & Record<string, unknown>;

/** A layer's style fields, and the setter of each. */
const STYLE_SETTERS = [
  ["fillStyleId", "setFillStyleIdAsync"],
  ["strokeStyleId", "setStrokeStyleIdAsync"],
  ["effectStyleId", "setEffectStyleIdAsync"],
  ["textStyleId", "setTextStyleIdAsync"],
] as const;

/** Bound fields that hold paints and effects: they are rebound through the paints, not set as a field. */
const LIST_FIELDS: ReadonlySet<string> = new Set([
  "fills",
  "strokes",
  "effects",
  "textRangeFills",
  "componentProperties",
]);

const WORDS: Readonly<Record<string, string>> = {
  COLOR: "colour variable",
  FLOAT: "number variable",
  STRING: "string variable",
  BOOLEAN: "boolean variable",
  PAINT: "paint style",
  TEXT: "text style",
  EFFECT: "effect style",
};

/** Rebinds every use of each `from` token among the layers to its `to` token; a pair that cannot be is an error. */
export async function remapTokens(
  layers: readonly SceneNode[],
  input: BindInput,
  context: BindContext,
  report: BindReport,
): Promise<void> {
  const pairs: RemapPair[] = [];

  for (const { from, to } of input.remap) {
    const pair = pairOf(from, to, context.index);

    if (typeof pair === "string") {
      report.error(from, pair);
    } else {
      pairs.push(pair);
    }
  }

  for (const layer of layers) {
    for (const pair of pairs) {
      const run = {
        pair,
        context,
        dryRun: input.dryRun,
      };
      const count =
        pair.source.source === "style"
          ? await remapStyle(layer as Fields, run)
          : await remapVariable(layer as Fields, run);

      if (count > 0) {
        report.remapped(pair.from, pair.to, layer, count);
      }
    }
  }
}

/** The pair's style or variable each, of one kind; a sentence saying why not otherwise. */
function pairOf(from: string, to: string, index: BindIndex): RemapPair | string {
  const [source, ...others] = index.byToken(from);
  const [target, ...more] = index.byToken(to);
  const missing = source === undefined ? from : target === undefined ? to : null;

  if (missing !== null) {
    return `${missing} names no style or variable here: tokens_read lists them.`;
  }

  if (source === undefined || target === undefined || others.length > 0 || more.length > 0) {
    return `${others.length > 0 ? from : to} names a style and a variable: rebind one of them by its own token.`;
  }

  if (source.source !== target.source || source.type !== target.type) {
    return `${from} is a ${WORDS[source.type] ?? source.type} and ${to} a ${WORDS[target.type] ?? target.type}: rebind a token to one of its own kind.`;
  }

  return {
    from,
    to,
    source,
    target,
  };
}

/** A layer's style fields (and a text's runs) set to the `from` style, set to the `to` one. */
async function remapStyle(layer: Fields, { pair, context, dryRun }: RemapRun): Promise<number> {
  let count = 0;

  for (const [key, setter] of STYLE_SETTERS) {
    if (layer[key] === pair.source.id) {
      count += 1;

      if (!dryRun) {
        if (key === "textStyleId") {
          await loadTextFonts(layer as TextNode, await context.style(pair.target.id));
        }

        await (layer[setter] as (id: string) => Promise<void>).call(layer, pair.target.id);
      }
    }
  }

  return (
    count +
    (await remapRunStyles(layer, {
      pair,
      context,
      dryRun,
    }))
  );
}

/** A text's runs set to the `from` style, where the text's own style fields say mixed. */
async function remapRunStyles(layer: Fields, { pair, context, dryRun }: RemapRun): Promise<number> {
  if (layer.type !== "TEXT" || (layer.fillStyleId !== figma.mixed && layer.textStyleId !== figma.mixed)) {
    return 0;
  }

  const text = layer as TextNode;
  let count = 0;

  for (const segment of text.getStyledTextSegments(["fillStyleId", "textStyleId"])) {
    const fill = segment.fillStyleId === pair.source.id;
    const style = segment.textStyleId === pair.source.id;

    count += Number(fill) + Number(style);

    if (!dryRun && (fill || style)) {
      await loadTextFonts(text, style ? await context.style(pair.target.id) : undefined);
      await (fill
        ? text.setRangeFillStyleIdAsync(segment.start, segment.end, pair.target.id)
        : text.setRangeTextStyleIdAsync(segment.start, segment.end, pair.target.id));
    }
  }

  return count;
}

/** A layer's fields, paints and effects bound to the `from` variable, bound to the `to` one. */
async function remapVariable(layer: Fields, run: RemapRun): Promise<number> {
  const target = run.dryRun ? null : await run.context.variable(run.pair.target.id);
  let count = 0;

  for (const [field, alias] of Object.entries((layer.boundVariables ?? {}) as Record<string, unknown>)) {
    if (!LIST_FIELDS.has(field) && (alias as { id?: unknown } | undefined)?.id === run.pair.source.id) {
      count += 1;

      if (target !== null) {
        layer.setBoundVariable(field as VariableBindableNodeField, target);
      }
    }
  }

  return (
    count +
    remapPaints(layer, "fills", run, target) +
    remapPaints(layer, "strokes", run, target) +
    remapEffects(layer, run, target)
  );
}

/** A layer's paints bound to the `from` variable, bound to the `to` one at the opacities they had. */
function remapPaints(layer: Fields, key: "fills" | "strokes", { pair }: RemapRun, target: Variable | null): number {
  const paints = layer[key];

  if (!Array.isArray(paints)) {
    return 0;
  }

  const hit = (paint: Paint) => paint.type === "SOLID" && paint.boundVariables?.color?.id === pair.source.id;
  const count = (paints as Paint[]).filter(hit).length;

  if (count > 0 && target !== null) {
    const wanted = (paints as Paint[]).map((paint) =>
      hit(paint) ? figma.variables.setBoundVariableForPaint(paint as SolidPaint, "color", target) : paint,
    );

    layer[key] = wanted;
    layer[key] = opacitiesAgain(layer[key] as Paint[], wanted) ?? layer[key];
  }

  return count;
}

/** A layer's effects with a field bound to the `from` variable, bound to the `to` one. */
function remapEffects(layer: Fields, { pair }: RemapRun, target: Variable | null): number {
  const effects = layer.effects;

  if (!Array.isArray(effects)) {
    return 0;
  }

  let count = 0;
  const next = (effects as Effect[]).map((effect) => {
    const fields = Object.entries(boundOf(effect)).filter(([, alias]) => alias?.id === pair.source.id);

    count += fields.length;

    return target === null
      ? effect
      : fields.reduce(
          (each, [field]) =>
            figma.variables.setBoundVariableForEffect(each, field as VariableBindableEffectField, target),
          effect,
        );
  });

  if (count > 0 && target !== null) {
    layer.effects = next;
  }

  return count;
}

/** An effect's bound fields; a shader effect has none. */
function boundOf(effect: Effect): Record<string, VariableAlias | undefined> {
  return "boundVariables" in effect ? ((effect.boundVariables ?? {}) as Record<string, VariableAlias | undefined>) : {};
}

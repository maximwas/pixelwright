import { type BindCandidate, type BindScope, colorValue, fillScope, type ModeMap } from "@pixelwright/core";
import { loadTextFonts } from "../../figma/fonts.ts";
import { opacitiesAgain } from "../../figma/paints.ts";
import { variableColor } from "../../figma/variable-color.ts";
import type { BindContext } from "./bind-context.ts";
import { merged, type RawUse } from "./raw-use.ts";

type PaintKey = "fills" | "strokes";

type Painted = SceneNode & Partial<Record<PaintKey, unknown>> & Record<string, unknown>;

const STYLE_KEYS: Readonly<Record<PaintKey, string>> = {
  fills: "fillStyleId",
  strokes: "strokeStyleId",
};

/** Where a raw paint is and what it is: the layer's paint key and index, and the paint itself. */
interface PaintPlace {
  readonly layer: Painted;
  readonly key: PaintKey;
  readonly index: number;
  readonly paint: SolidPaint;
}

const isRawSolid = (paint: Paint): paint is SolidPaint =>
  paint.type === "SOLID" && (paint.visible ?? true) && paint.boundVariables?.color === undefined;

/** The raw solid colours a layer paints with: its fills (a text's runs when they differ) and its strokes. */
export async function colorUses(layer: SceneNode, context: BindContext): Promise<RawUse[]> {
  const fills =
    layer.type === "TEXT" && layer.fills === figma.mixed
      ? runUses(layer, context)
      : await paintUses(layer as Painted, "fills", context);

  return [...fills, ...(await paintUses(layer as Painted, "strokes", context))];
}

/** A layer's raw solid paints of one key, unless a style paints it. */
async function paintUses(layer: Painted, key: PaintKey, context: BindContext): Promise<RawUse[]> {
  const paints = layer[key];

  if (!Array.isArray(paints) || layer[STYLE_KEYS[key]] !== "") {
    return [];
  }

  const inferred = (layer.inferredVariables as Record<string, unknown[]> | undefined)?.[key] ?? [];
  const uses: RawUse[] = [];

  for (const [index, paint] of (paints as Paint[]).entries()) {
    if (isRawSolid(paint)) {
      const place = {
        layer,
        key,
        index,
        paint,
      };
      const stylable = paints.length === 1;
      const { value, candidates } = colorCandidates(place, context, stylable);

      uses.push({
        layer,
        kind: "color",
        field: key === "strokes" ? "border" : layer.type === "TEXT" ? "color" : "background",
        value,
        stylable,
        candidates: merged(candidates, await context.inferred(inferred[index])),
        bind: (candidate, snapped) => bindPaint(place, candidate, snapped, context),
      });
    }
  }

  return uses;
}

/**
 * The tokens holding a paint's colour: those holding it with its opacity, else the opaque colour variables of its own
 * colour, which the paint keeps its opacity over (a design's `black 10%`).
 */
function colorCandidates(
  { layer, key, paint }: PaintPlace,
  context: BindContext,
  stylable: boolean,
): { value: string; candidates: BindCandidate[] } {
  const scope: BindScope = key === "strokes" ? "STROKE_COLOR" : fillScope(layer.type);
  const modes: ModeMap = context.modes(layer);
  const value = colorValue(paint.color, paint.opacity ?? 1, context.space);
  const exact = context.index.colors(value, {
    scope,
    modes,
    stylable,
  });
  const opaque =
    exact.length > 0 || (paint.opacity ?? 1) >= 1
      ? []
      : context.index.colors(colorValue(paint.color, 1, context.space), {
          scope,
          modes,
          stylable: false,
        });

  return {
    value,
    candidates: [...exact, ...opaque],
  };
}

/** Binds a paint to a paint style (the layer's one paint) or a colour variable, at the opacity it should keep. */
async function bindPaint(
  { layer, key, index, paint }: PaintPlace,
  candidate: BindCandidate,
  snapped: boolean,
  context: BindContext,
): Promise<void> {
  if (candidate.source === "style") {
    await setPaintStyle(layer, key, candidate.id);

    return;
  }

  const variable = await context.variable(candidate.id);
  const opacity = await opacityOf(paint, variable, layer, snapped);
  const paints = [...(layer[key] as Paint[])];

  paints[index] = figma.variables.setBoundVariableForPaint(paint, "color", variable);
  layer[key] = paints;

  const again = opacitiesAgain(
    layer[key] as Paint[],
    paints.map((each, at) =>
      at === index
        ? {
            ...each,
            opacity,
          }
        : each,
    ),
  );

  if (again !== null) {
    layer[key] = again;
  }
}

/** A paint style as the whole list of a layer's fills or strokes. */
async function setPaintStyle(layer: SceneNode, key: PaintKey, id: string): Promise<void> {
  if (key === "fills" && "setFillStyleIdAsync" in layer) {
    await layer.setFillStyleIdAsync(id);
  } else if (key === "strokes" && "setStrokeStyleIdAsync" in layer) {
    await layer.setStrokeStyleIdAsync(id);
  }
}

/**
 * The opacity a bound paint keeps: its own, which equals its token's alpha, or is laid over an opaque token; a paint
 * snapped to a token takes the token's alpha with its own opacity over it.
 */
async function opacityOf(paint: SolidPaint, variable: Variable, layer: SceneNode, snapped: boolean): Promise<number> {
  const own = paint.opacity ?? 1;

  return snapped ? ((await variableColor(variable, layer))?.a ?? 1) * own : own;
}

/** A text's runs of raw solid colour, where its runs differ: each bound on its own range. */
function runUses(text: TextNode, context: BindContext): RawUse[] {
  return text
    .getStyledTextSegments(["fills", "fillStyleId"])
    .flatMap((segment) => {
      const [paint] = segment.fills;

      return segment.fillStyleId === "" && segment.fills.length === 1 && paint !== undefined && isRawSolid(paint)
        ? [
            {
              segment,
              paint,
            },
          ]
        : [];
    })
    .map(({ segment, paint }) => {
      const value = colorValue(paint.color, paint.opacity ?? 1, context.space);

      return {
        layer: text,
        kind: "color" as const,
        field: "color",
        value,
        stylable: true,
        candidates: context.index.colors(value, {
          scope: "TEXT_FILL",
          modes: context.modes(text),
          stylable: true,
        }),
        bind: (candidate: BindCandidate, snapped: boolean) =>
          bindRun(
            {
              text,
              start: segment.start,
              end: segment.end,
              paint,
            },
            candidate,
            snapped,
            context,
          ),
      };
    });
}

/** A run of a text and its one raw paint. */
interface RunPlace {
  readonly text: TextNode;
  readonly start: number;
  readonly end: number;
  readonly paint: SolidPaint;
}

/** Binds a text run's colour: a paint style on the range, or a paint bound to the variable, made with its colour. */
async function bindRun(
  { text, start, end, paint }: RunPlace,
  candidate: BindCandidate,
  snapped: boolean,
  context: BindContext,
): Promise<void> {
  await loadTextFonts([text]);

  if (candidate.source === "style") {
    await text.setRangeFillStyleIdAsync(start, end, candidate.id);

    return;
  }

  const variable = await context.variable(candidate.id);
  const color = await variableColor(variable, text);
  const bound = figma.variables.setBoundVariableForPaint(
    {
      ...paint,
      color: {
        r: color?.r ?? paint.color.r,
        g: color?.g ?? paint.color.g,
        b: color?.b ?? paint.color.b,
      },
      opacity: await opacityOf(paint, variable, text, snapped),
    },
    "color",
    variable,
  );

  text.setRangeFills(start, end, [bound]);
}

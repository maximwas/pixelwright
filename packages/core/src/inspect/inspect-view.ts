import { colorCss } from "../css/color.ts";
import { px } from "../css/format.ts";
import { interactionSummary } from "../css/interactions.ts";
import { paintsCss } from "../css/paint.ts";
import { styleTokenName } from "../css/tokens.ts";
import { MIXED } from "../schemas/snapshot.ts";
import type { InspectBox, InspectedLayer, InspectedLayerView, InspectRaw, InspectView } from "../types/inspect.ts";
import type { TextSegment } from "../types/snapshot.ts";
import { unwrapVar } from "../utils/css-value.ts";

/** How far two boxes may differ and still be the same box. */
const SAME = 0.01;
/** How far a layer may reach past its parent's room before it counts as overflowing. */
const PAST = 0.5;

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * What inspect gives for each layer, from the plugin's raw read: boxes, how strokes paint, every effect, a text's
 * lines and line heights, overflow, interactions and the component. Nothing here is guessed from CSS.
 */
export function inspectView(raw: InspectRaw): InspectView {
  return {
    relativeTo: raw.origin === null ? "the page" : `${raw.origin.id} "${raw.origin.name}"`,
    layers: raw.layers.map((layer) => layerView(layer, raw)),
    missing: raw.missing,
  };
}

function layerView(layer: InspectedLayer, raw: InspectRaw): InspectedLayerView {
  const view: InspectedLayerView = {
    id: layer.id,
    name: layer.name,
    type: layer.type,
    parent: layer.parent,
    box: layer.box,
  };
  const overflow = overflowOf(layer);
  const strokes = strokesOf(layer);
  const text = textOf(layer);
  const fills = fillsOf(layer, raw);
  const interactions = (layer.reactions ?? []).map((reaction) => ({
    trigger: reaction.trigger?.type ?? "NONE",
    summary: interactionSummary(reaction),
    reaction,
  }));

  if (layer.paintedBox !== null && !sameBox(layer.paintedBox, layer.box)) {
    view.paintedBox = layer.paintedBox;
  }

  if (layer.rotation !== undefined && layer.rotation !== 0) {
    view.rotation = layer.rotation;
  }

  if (overflow !== null) {
    view.overflow = overflow;
  }

  if (strokes !== null) {
    view.strokes = strokes;
  }

  if (fills !== null) {
    view.fills = fills;
  }

  if (layer.effects !== undefined && layer.effects.length > 0) {
    view.effects = layer.effects;
  }

  if (text !== null) {
    view.text = text;
  }

  if (interactions.length > 0) {
    view.interactions = interactions;
  }

  const instance = layer.instance;

  if (instance !== undefined) {
    view.component = {
      name: instance.componentName,
      ...(instance.setName === undefined ? {} : { set: instance.setName }),
      variant: Object.fromEntries(
        Object.entries(instance.properties)
          .filter(([, property]) => property.type === "VARIANT")
          .map(([name, property]) => [name, String(property.value)]),
      ),
    };
  }

  return view;
}

/**
 * The fill as a CSS value, resolved (a style's own value, not its var()), with the style and the variables behind it;
 * a gradient as Figma writes it for the layer. Null when nothing visible fills it.
 */
function fillsOf(layer: InspectedLayer, raw: InspectRaw): NonNullable<InspectedLayerView["fills"]> | null {
  if (!Array.isArray(layer.fills) || !layer.fills.some((paint) => paint.visible !== false)) {
    return null;
  }

  const context = {
    styles: raw.styles ?? {},
    variables: raw.variables ?? {},
    tokens: new Map<string, string>(),
    root: layer,
  };
  const value = paintsCss(layer.fills, undefined, layer, context);
  const style =
    typeof layer.fillStyleId === "string" && layer.fillStyleId !== "" ? raw.styles?.[layer.fillStyleId] : undefined;

  return {
    css: typeof value === "string" ? value : (unwrapVar(layer.css?.background) ?? "a paint CSS cannot hold"),
    ...(style === undefined
      ? {}
      : {
          style: {
            name: style.name,
            token: styleTokenName(style),
          },
        }),
    ...(context.tokens.size === 0 ? {} : { tokens: Object.fromEntries(context.tokens) }),
  };
}

function sameBox(a: InspectBox, b: InspectBox): boolean {
  return (
    Math.abs(a.x - b.x) <= SAME &&
    Math.abs(a.y - b.y) <= SAME &&
    Math.abs(a.width - b.width) <= SAME &&
    Math.abs(a.height - b.height) <= SAME
  );
}

/** How far the layer's box reaches past its parent's room: the parent's box, less its padding in auto layout. */
function overflowOf(layer: InspectedLayer): NonNullable<InspectedLayerView["overflow"]> | null {
  if (layer.parentBox === null || layer.layoutPositioning === "ABSOLUTE") {
    return null;
  }

  const padding = layer.parentPadding ?? {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
  const room = {
    left: layer.parentBox.x + padding.left,
    top: layer.parentBox.y + padding.top,
    right: layer.parentBox.x + layer.parentBox.width - padding.right,
    bottom: layer.parentBox.y + layer.parentBox.height - padding.bottom,
  };
  const { box } = layer;
  const sides = {
    left: room.left - box.x,
    right: box.x + box.width - room.right,
    top: room.top - box.y,
    bottom: box.y + box.height - room.bottom,
  };
  const past = Object.entries(sides).filter(([, value]) => value > PAST);

  return past.length === 0 ? null : Object.fromEntries(past.map(([side, value]) => [side, round(value)]));
}

function strokesOf(layer: InspectedLayer): NonNullable<InspectedLayerView["strokes"]> | null {
  if (!Array.isArray(layer.strokes) || layer.strokes.length === 0) {
    return null;
  }

  const strokes: NonNullable<InspectedLayerView["strokes"]> = {
    align: (layer.strokeAlign ?? "INSIDE").toLowerCase(),
    colors: layer.strokes.map((paint) =>
      paint.type === "SOLID" && paint.color !== undefined
        ? colorCss(paint.color, paint.opacity ?? 1)
        : paint.type.toLowerCase(),
    ),
  };

  if (layer.strokeWeight === MIXED) {
    strokes.weights = {
      top: layer.strokeTopWeight ?? 0,
      right: layer.strokeRightWeight ?? 0,
      bottom: layer.strokeBottomWeight ?? 0,
      left: layer.strokeLeftWeight ?? 0,
    };
  } else if (typeof layer.strokeWeight === "number") {
    strokes.weight = layer.strokeWeight;
  }

  if (layer.dashPattern !== undefined && layer.dashPattern.length > 0) {
    strokes.dashes = layer.dashPattern;
  }

  if (layer.strokesIncludedInLayout !== undefined) {
    strokes.includedInLayout = layer.strokesIncludedInLayout;
  }

  return strokes;
}

/** A text's lines, each with what ended it (Shift+Enter: line, Enter: paragraph), and its distinct line heights. */
function textOf(layer: InspectedLayer): NonNullable<InspectedLayerView["text"]> | null {
  const text = layer.text;

  if (text === undefined) {
    return null;
  }

  const lines: { text: string; break: "line" | "paragraph" | null }[] = [];
  let current = "";

  for (const char of text.characters) {
    if (char === " " || char === "\n") {
      lines.push({
        text: current,
        break: char === "\n" ? "paragraph" : "line",
      });
      current = "";
    } else {
      current += char;
    }
  }

  lines.push({
    text: current,
    break: null,
  });

  const view: NonNullable<InspectedLayerView["text"]> = {
    lines,
    lineHeights: [...new Set(text.segments.map(lineHeightText))],
    fontSizes: [...new Set(text.segments.map((segment) => segment.fontSize))],
    autoResize: text.textAutoResize,
  };

  if (typeof text.paragraphSpacing === "number" && text.paragraphSpacing !== 0) {
    view.paragraphSpacing = text.paragraphSpacing;
  }

  return view;
}

function lineHeightText({ lineHeight, fontSize }: TextSegment): string {
  if (lineHeight.unit === "PIXELS" && lineHeight.value !== undefined) {
    return px(lineHeight.value);
  }

  if (lineHeight.unit === "PERCENT" && lineHeight.value !== undefined) {
    return `${round(lineHeight.value)}% (${px((fontSize * lineHeight.value) / 100)})`;
  }

  return "auto";
}

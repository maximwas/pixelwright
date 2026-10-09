import type { AxisPlacement, EffectSpec, FigmaProps, GridTrack, LengthValue, PaintSpec } from "@pixelwright/core";
import type { Layer, WriteContext } from "../types/apply.ts";
import { WriteError } from "./write-error.ts";

/** One step of writing a layer: the properties it takes. */
interface Step {
  readonly keys: readonly (keyof FigmaProps)[];
  readonly write: (node: Layer, props: FigmaProps, context: WriteContext) => void | Promise<void>;
}

type Limit = "minWidth" | "maxWidth" | "minHeight" | "maxHeight";

const PADDING = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const;
const CORNERS = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"] as const;
const SIDES = ["Top", "Right", "Bottom", "Left"] as const;
const LIMITS: readonly Limit[] = ["minWidth", "maxWidth", "minHeight", "maxHeight"];

/** A property set as it is, when it differs. */
const plainStep = (key: keyof FigmaProps): Step => ({
  keys: [key],
  write: (node, props) => set(node, key, props[key]),
});

/** A length property, a number or a token bound to its variable. */
const lengthStep = (key: "itemSpacing" | "counterAxisSpacing" | "gridColumnGap" | "gridRowGap"): Step => ({
  keys: [key],
  write: (node, props, context) => setLength(node, key, props[key] ?? 0, context),
});

/**
 * Figma's order: the layer's own layout before anything sized in it, sizes before placement (an edge pin needs the
 * size), the turn before placement (a turned layer is placed by its centre), then paint. Text comes after, on its own.
 */
export const STEPS: readonly Step[] = [
  plainStep("name"),
  plainStep("visible"),
  plainStep("layoutMode"),
  plainStep("layoutWrap"),
  {
    keys: ["padding"],
    write: async (node, { padding }, context) => {
      for (const [index, field] of PADDING.entries()) {
        await setLength(node, field, padding?.[index] ?? 0, context);
      }
    },
  },
  lengthStep("itemSpacing"),
  lengthStep("counterAxisSpacing"),
  plainStep("primaryAxisAlignItems"),
  plainStep("counterAxisAlignItems"),
  plainStep("counterAxisAlignContent"),
  {
    keys: ["gridColumns"],
    write: (node, { gridColumns }) => tracks(node, "Column", gridColumns ?? []),
  },
  {
    keys: ["gridRows"],
    write: (node, { gridRows }) => tracks(node, "Row", gridRows ?? []),
  },
  lengthStep("gridColumnGap"),
  lengthStep("gridRowGap"),
  {
    keys: ["absolute"],
    write: positioning,
  },
  {
    keys: ["width"],
    write: size("width"),
  },
  {
    keys: ["height"],
    write: size("height"),
  },
  ...LIMITS.map(
    (key): Step => ({
      keys: [key],
      write: (node, props, context) => limit(node, key, props[key], context),
    }),
  ),
  {
    keys: ["grow"],
    write: grow,
  },
  {
    keys: ["alignSelf"],
    write: alignSelf,
  },
  {
    keys: ["justifySelf"],
    write: justifySelf,
  },
  {
    keys: ["gridRow", "gridColumn"],
    write: cell,
  },
  {
    keys: ["rotation", "mirror"],
    write: transform,
  },
  {
    keys: ["horizontal"],
    write: place("horizontal"),
  },
  {
    keys: ["vertical"],
    write: place("vertical"),
  },
  plainStep("opacity"),
  plainStep("clipsContent"),
  {
    keys: ["cornerRadius"],
    write: radius,
  },
  {
    keys: ["fills"],
    write: fills,
  },
  {
    keys: ["strokes"],
    write: strokes,
  },
  {
    keys: ["effects"],
    write: effects,
  },
  {
    keys: ["description"],
    write: (node, { description }) => {
      if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") {
        throw new WriteError("A description belongs to a component or a component set.");
      }

      set(node, "description", description);
    },
  },
  {
    keys: ["notes"],
    write: notesStep,
  },
  {
    keys: ["hyperlink"],
    write: (node) => {
      if (node.type !== "TEXT") {
        throw new WriteError(
          "A link on a frame is a prototype reaction: it is written in the next stage.",
          "A Text takes href.",
        );
      }
    },
  },
];

export function set(node: Layer, key: string, value: unknown): void {
  if (!same(node[key], value)) {
    node[key] = value;
  }
}

function same(live: unknown, wanted: unknown): boolean {
  return (
    live === wanted || (typeof live === "object" && live !== null && JSON.stringify(live) === JSON.stringify(wanted))
  );
}

function boundTo(node: Layer, field: string): string | undefined {
  return node.boundVariables?.[field]?.id;
}

/** A length: a number (unbinding a variable it had), or a token bound to its number variable. */
async function setLength(node: Layer, field: string, value: LengthValue, context: WriteContext): Promise<void> {
  if (typeof value === "number") {
    if (boundTo(node, field) !== undefined) {
      node.setBoundVariable(field, null);
    }

    set(node, field, value);

    return;
  }

  const variable = await (await context.tokens()).variable(value.token, "FLOAT");

  if (boundTo(node, field) !== variable.id) {
    node.setBoundVariable(field, variable);
  }
}

function hasLayout(node: Layer | null): boolean {
  return typeof node?.layoutMode === "string" && node.layoutMode !== "NONE";
}

function flexOf(node: Layer | null): "HORIZONTAL" | "VERTICAL" | null {
  return node?.layoutMode === "HORIZONTAL" || node?.layoutMode === "VERTICAL" ? node.layoutMode : null;
}

function tracks(node: Layer, axis: "Column" | "Row", sizes: readonly GridTrack[]): void {
  set(node, `grid${axis}Count`, sizes.length);
  set(
    node,
    `grid${axis}Sizes`,
    sizes.map((track) => ({ ...track })),
  );
}

function positioning(node: Layer, { absolute }: FigmaProps): void {
  // A frame without auto layout places every child itself: nothing to change there.
  if (hasLayout(node.parent)) {
    set(node, "layoutPositioning", absolute ? "ABSOLUTE" : "AUTO");
  }
}

function size(axis: "width" | "height"): Step["write"] {
  const sizing = axis === "width" ? "layoutSizingHorizontal" : "layoutSizingVertical";

  return async (node, props, context) => {
    const value = props[axis];

    if (value === undefined) {
      return;
    }

    if (value === "HUG") {
      if (node.type === "TEXT") {
        set(
          node,
          "textAutoResize",
          axis === "width" || node.textAutoResize === "WIDTH_AND_HEIGHT" ? "WIDTH_AND_HEIGHT" : "HEIGHT",
        );
      } else {
        set(node, sizing, "HUG");
      }

      return;
    }

    if (node.type === "TEXT") {
      // A fixed width lets the height follow the text; a fixed height fixes both.
      set(
        node,
        "textAutoResize",
        axis === "height" ? "NONE" : node.textAutoResize === "WIDTH_AND_HEIGHT" ? "HEIGHT" : node.textAutoResize,
      );
    } else if (hasLayout(node) || hasLayout(node.parent)) {
      set(node, sizing, "FIXED");
    }

    if (typeof value !== "number") {
      const variable = await (await context.tokens()).variable(value.token, "FLOAT");

      if (boundTo(node, axis) !== variable.id) {
        node.setBoundVariable(axis, variable);
      }

      return;
    }

    if (node.type === "LINE") {
      // A line is as long as it is wide; a standing one is written with its height and stands upright, as read.
      if (node.width !== value) {
        node.resize(value, 0);
      }

      if (axis === "height" && !standing(node)) {
        transform(node, {
          rotation: -90,
          mirror: false,
        });
      }

      return;
    }

    if (node[axis] !== value) {
      resizeKeeping(
        node,
        axis === "width" ? Math.max(value, 0.01) : node.width,
        axis === "height" ? Math.max(value, 0.01) : node.height,
      );
    }
  };
}

/**
 * resize(), keeping how the layer sizes itself: Figma's resize fixes the size on both axes and stops a text sizing
 * itself, while the XML changed one size only.
 */
function resizeKeeping(node: Layer, width: number, height: number): void {
  const kept = [
    ["layoutSizingHorizontal", node.layoutSizingHorizontal],
    ["layoutSizingVertical", node.layoutSizingVertical],
    ["textAutoResize", node.textAutoResize],
  ] as const;

  node.resize(width, height);

  for (const [key, value] of kept) {
    if (value !== undefined && node[key] !== value) {
      node[key] = value;
    }
  }
}

/** A line turned upright (within half a degree), as design_read writes it: a height and its left border. */
function standing(node: Layer): boolean {
  const [[a = 1]] = node.relativeTransform;

  return Math.abs(a) < Math.sin((0.5 * Math.PI) / 180);
}

async function limit(node: Layer, key: Limit, value: LengthValue | null | undefined, context: WriteContext) {
  if (value === undefined) {
    return;
  }

  if (value === null) {
    if (boundTo(node, key) !== undefined) {
      node.setBoundVariable(key, null);
    }

    set(node, key, null);

    return;
  }

  await setLength(node, key, value, context);
}

/** flex: 1 fills the flex parent's direction. */
function grow(node: Layer, { grow: fill }: FigmaProps): void {
  const direction = flexOf(node.parent);

  if (direction === null) {
    throw new WriteError(
      "flex fills the direction of an auto layout parent: this layer's parent has no auto layout.",
      'Give the parent display="flex", or size the layer with width or height.',
    );
  }

  fillAxis(node, direction === "HORIZONTAL" ? "layoutSizingHorizontal" : "layoutSizingVertical", fill ?? false);
}

function fillAxis(node: Layer, sizing: "layoutSizingHorizontal" | "layoutSizingVertical", fill: boolean): void {
  if (fill) {
    set(node, sizing, "FILL");
  } else if (node[sizing] === "FILL") {
    node[sizing] = "FIXED";
  }
}

/** In a flex parent, STRETCH fills across its direction; in a grid, the child's place in its cell, STRETCH filling it. */
function alignSelf(node: Layer, { alignSelf: align }: FigmaProps): void {
  const parent = node.parent;
  const direction = flexOf(parent);

  if (direction !== null) {
    if (align !== "STRETCH" && align !== "AUTO") {
      throw new WriteError(
        "Auto layout aligns its children together: align-self takes stretch or auto here.",
        "Set align-items on the parent.",
      );
    }

    fillAxis(node, direction === "HORIZONTAL" ? "layoutSizingVertical" : "layoutSizingHorizontal", align === "STRETCH");
  } else if (parent?.layoutMode === "GRID") {
    gridAlign(node, "Vertical", align);
  } else {
    throw new WriteError("align-self places a child of auto layout or a grid: this layer's parent has neither.");
  }
}

function justifySelf(node: Layer, { justifySelf: align }: FigmaProps): void {
  if (node.parent?.layoutMode !== "GRID") {
    throw new WriteError("justify-self places a grid's child in its cell: this layer's parent is no grid.");
  }

  gridAlign(node, "Horizontal", align);
}

function gridAlign(node: Layer, axis: "Horizontal" | "Vertical", align: FigmaProps["alignSelf"]): void {
  const sizing = axis === "Horizontal" ? "layoutSizingHorizontal" : "layoutSizingVertical";

  fillAxis(node, sizing, align === "STRETCH");

  if (align !== "STRETCH") {
    set(node, `gridChild${axis}Align`, align ?? "AUTO");
  }
}

function cell(node: Layer, { gridRow, gridColumn }: FigmaProps): void {
  if (node.parent?.layoutMode !== "GRID") {
    throw new WriteError("grid-row and grid-column place a grid's child: this layer's parent is no grid.");
  }

  const row = gridRow?.anchor ?? (node.gridRowAnchorIndex as number);
  const column = gridColumn?.anchor ?? (node.gridColumnAnchorIndex as number);

  if (row !== node.gridRowAnchorIndex || column !== node.gridColumnAnchorIndex) {
    node.setGridChildPosition(row, column);
  }

  if (gridRow !== undefined) {
    set(node, "gridRowSpan", gridRow.span);
  }

  if (gridColumn !== undefined) {
    set(node, "gridColumnSpan", gridColumn.span);
  }
}

/**
 * The turn and the mirror, about the layer's centre as CSS turns. Figma's matrix for a turn of r degrees is
 * [[cos r, sin r], [-sin r, cos r]]; a mirror flips the layer's own x first (design_read reads it back the same way).
 */
function transform(node: Layer, { rotation = 0, mirror = false }: FigmaProps): void {
  const [[a0 = 1, b0 = 0, x0 = 0], [c0 = 0, d0 = 1, y0 = 0]] = node.relativeTransform;
  const half = [node.width / 2, node.height / 2] as const;
  const centre = [a0 * half[0] + b0 * half[1] + x0, c0 * half[0] + d0 * half[1] + y0] as const;
  const turn = (rotation * Math.PI) / 180;
  const cos = snap(Math.cos(turn));
  const sin = snap(Math.sin(turn));
  const [a, b, c, d] = mirror ? [-cos, sin, sin, cos] : [cos, sin, -sin, cos];

  setTransform(node, [
    [a, b, centre[0] - (a * half[0] + b * half[1])],
    [c, d, centre[1] - (c * half[0] + d * half[1])],
  ]);
}

function snap(value: number): number {
  return Math.abs(value) < 1e-10 ? 0 : value;
}

function setTransform(node: Layer, next: Transform): void {
  const live = node.relativeTransform.flat();

  if (next.flat().some((value, index) => Math.abs(value - (live[index] ?? 0)) > 1e-6)) {
    node.relativeTransform = next;
  }
}

/**
 * One axis of an absolute layer, from design_read's constraint: its edge offsets give where its unturned box starts,
 * and the layer is placed by its centre, as the read measured it. A group places its layers in its parent's space.
 */
function place(axis: "horizontal" | "vertical"): Step["write"] {
  const length = axis === "horizontal" ? "width" : "height";

  return (node, props) => {
    const spec = props[axis] as AxisPlacement;
    const parent = node.parent;

    if (parent === null) {
      return;
    }

    if (hasLayout(parent) && node.layoutPositioning !== "ABSOLUTE") {
      throw new WriteError(
        `${axis === "horizontal" ? "left and right" : "top and bottom"} place a layer with position="absolute": this one flows in its auto layout parent.`,
      );
    }

    const page = parent.type === "PAGE";
    const span = page ? 0 : parent[length];

    if (page && spec.kind !== "MIN") {
      throw new WriteError("A layer on the page is placed by left and top alone.");
    }

    // design_read places a level or standing line by the box it covers; other layers by their unturned box's centre.
    const line = node.type === "LINE" && (standing(node) || Math.abs(node.relativeTransform[0]?.[1] ?? 0) < 1e-6);
    const [[a0 = 1, b0 = 0], [c0 = 0, d0 = 1]] = node.relativeTransform;
    const covered =
      axis === "horizontal"
        ? Math.abs(a0) * node.width + Math.abs(b0) * node.height
        : Math.abs(c0) * node.width + Math.abs(d0) * node.height;
    let start: number;
    let size = line ? covered : node[length];

    if (spec.kind === "STRETCH") {
      start = spec.start;
      size = span - spec.start - spec.end;
    } else if (spec.kind === "SCALE") {
      start = (span * spec.start) / 100;
      size = (span * spec.size) / 100;
    } else {
      start =
        spec.kind === "MIN" ? spec.offset : spec.kind === "MAX" ? span - spec.offset - size : span / 2 + spec.offset;
    }

    if (!line && size !== node[length]) {
      resizeKeeping(
        node,
        axis === "horizontal" ? Math.max(size, 0.01) : node.width,
        axis === "vertical" ? Math.max(size, 0.01) : node.height,
      );
    }

    const group = parent.type === "GROUP";

    if (!group && !page && typeof node.constraints === "object" && node.constraints !== null) {
      set(node, "constraints", {
        ...node.constraints,
        [axis]: spec.kind,
      });
    }

    const origin = group ? (parent[axis === "horizontal" ? "x" : "y"] as number) : 0;
    const [[a = 1, b = 0, x = 0], [c = 0, d = 1, y = 0]] = node.relativeTransform;
    const half = [node.width / 2, node.height / 2] as const;
    const centre = origin + start + (line ? covered / 2 : axis === "horizontal" ? half[0] : half[1]);

    setTransform(
      node,
      axis === "horizontal"
        ? [
            [a, b, centre - (a * half[0] + b * half[1])],
            [c, d, y],
          ]
        : [
            [a, b, x],
            [c, d, centre - (c * half[0] + d * half[1])],
          ],
    );
  };
}

async function radius(node: Layer, { cornerRadius }: FigmaProps, context: WriteContext): Promise<void> {
  if (Array.isArray(cornerRadius)) {
    for (const [index, field] of CORNERS.entries()) {
      await setLength(node, field, cornerRadius[index] ?? 0, context);
    }
  } else if (cornerRadius !== undefined) {
    await setLength(node, "cornerRadius", cornerRadius as LengthValue, context);
  }
}

/** Paints as Figma takes them: one paint style alone, or layers of colours and colour variables. */
export async function paintsOf(
  specs: readonly PaintSpec[],
  context: Pick<WriteContext, "tokens" | "uploads">,
): Promise<{ style: string } | { paints: Paint[] }> {
  const [only] = specs;

  if (specs.length === 1 && only?.kind === "token" && only.opacity === 1) {
    const style = await (await context.tokens()).style(only.token, "PAINT");

    if (style !== null) {
      return { style };
    }
  }

  const paints: Paint[] = [];

  for (const spec of specs) {
    if (spec.kind === "color") {
      paints.push({
        type: "SOLID",
        color: {
          r: spec.color.r,
          g: spec.color.g,
          b: spec.color.b,
        },
        opacity: spec.color.a,
      });
      continue;
    }

    if (spec.kind === "image") {
      paints.push(imagePaint(spec, context));
      continue;
    }

    const index = await context.tokens();

    if ((await index.style(spec.token, "PAINT")) !== null) {
      throw new WriteError(
        `${spec.token} is a paint style, which is the whole list of a layer's paints.`,
        "Use it as the only layer, without color-mix().",
      );
    }

    paints.push(
      figma.variables.setBoundVariableForPaint(
        {
          type: "SOLID",
          color: {
            r: 0,
            g: 0,
            b: 0,
          },
          opacity: spec.opacity,
        },
        "color",
        await index.variable(spec.token, "COLOR"),
      ),
    );
  }

  return { paints };
}

/** An image layer from its uploaded file (Task 2 sends the bytes; until then a background image cannot be written). */
function imagePaint(spec: Extract<PaintSpec, { kind: "image" }>, context: Pick<WriteContext, "uploads">): ImagePaint {
  const bytes = spec.stream === undefined ? undefined : context.uploads?.(spec.stream);

  if (bytes === undefined) {
    throw new WriteError(`${spec.src} did not reach the plugin.`, "Give the file's path as design_read wrote it.");
  }

  return {
    type: "IMAGE",
    imageHash: figma.createImage(bytes).hash,
    scaleMode: spec.scaleMode,
  };
}

/** The parts of a paint that make it look as it does, to tell an equal one from a changed one. */
function paintKey(paint: Paint): string {
  const solid = paint as Partial<SolidPaint>;
  const round = (value: number | undefined) => Math.round((value ?? 0) * 10_000);

  return JSON.stringify([
    paint.type,
    paint.visible ?? true,
    round(paint.opacity ?? 1),
    solid.color === undefined ? null : [round(solid.color.r), round(solid.color.g), round(solid.color.b)],
    solid.boundVariables?.color?.id ?? null,
  ]);
}

export function samePaints(live: unknown, wanted: readonly Paint[]): boolean {
  return (
    Array.isArray(live) &&
    live.length === wanted.length &&
    live.every((paint: Paint, index) => paintKey(paint) === paintKey(wanted[index] as Paint))
  );
}

async function fills(node: Layer, { fills: specs }: FigmaProps, context: WriteContext): Promise<void> {
  const paints = await paintsOf(specs ?? [], context);

  if ("style" in paints) {
    if (node.fillStyleId !== paints.style) {
      await node.setFillStyleIdAsync(paints.style);
    }
  } else if (
    (typeof node.fillStyleId === "string" && node.fillStyleId !== "") ||
    !samePaints(node.fills, paints.paints)
  ) {
    node.fills = paints.paints;
  }
}

async function strokes(node: Layer, { strokes: spec }: FigmaProps, context: WriteContext): Promise<void> {
  if (spec === undefined) {
    return;
  }

  const paints = await paintsOf(spec.paints, context);

  if ("style" in paints) {
    if (node.strokeStyleId !== paints.style) {
      await node.setStrokeStyleIdAsync(paints.style);
    }
  } else if (
    (typeof node.strokeStyleId === "string" && node.strokeStyleId !== "") ||
    !samePaints(node.strokes, paints.paints)
  ) {
    node.strokes = paints.paints;
  }

  if (spec.paints.length === 0) {
    return;
  }

  const sides = spec.sides;

  if (spec.weight !== undefined || node.type === "LINE") {
    set(node, "strokeWeight", spec.weight ?? Math.max(sides?.top ?? 0, sides?.left ?? 0, 0));
  } else if (sides !== undefined) {
    for (const side of SIDES) {
      set(node, `stroke${side}Weight`, sides[side.toLowerCase() as "top" | "right" | "bottom" | "left"]);
    }
  }

  // A CSS border cannot tell inside from centred: a centred stroke stays centred. A line's stroke is always centred.
  if (node.type !== "LINE" && !(spec.align === "INSIDE" && node.strokeAlign === "CENTER")) {
    set(node, "strokeAlign", spec.align);
  }

  const dashed = Array.isArray(node.dashPattern) && node.dashPattern.length > 0;

  if (spec.dash !== dashed) {
    node.dashPattern = spec.dash ? [4, 4] : [];
  }
}

async function effects(node: Layer, { effects: spec }: FigmaProps, context: WriteContext): Promise<void> {
  if (spec === undefined) {
    return;
  }

  if (!Array.isArray(spec)) {
    const token = (spec as { token: string }).token;
    const style = await (await context.tokens()).style(token, "EFFECT");

    if (style === null) {
      throw new WriteError(`No effect style is named ${token} in this file or the libraries its page uses.`);
    }

    if (node.effectStyleId !== style) {
      await node.setEffectStyleIdAsync(style);
    }

    return;
  }

  set(
    node,
    "effects",
    mergedEffects(
      Array.isArray(node.effects) ? (node.effects as Effect[]) : [],
      effectsOf(spec as readonly EffectSpec[]),
    ),
  );
}

/** The effects CSS writes: shadows and plain blurs. */
const CSS_EFFECTS: ReadonlySet<string> = new Set(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]);

/**
 * The effects CSS wrote, each one the layer already has kept as it is (a shadow's colour variable, blend mode and
 * show-behind, a progressive blur of that radius), with what CSS cannot write and design_read never shows (noise,
 * texture, glass, hidden effects) kept where they were.
 */
export function mergedEffects(
  current: readonly Effect[],
  written: readonly Effect[],
  covered: ReadonlySet<string> = CSS_EFFECTS,
): Effect[] {
  const unused = current.filter((effect) => covered.has(effect.type) && (effect.visible ?? true));
  const merged = written.map((effect) => {
    const at = unused.findIndex((held) => effectKey(held) === effectKey(effect));

    return at === -1 ? effect : (unused.splice(at, 1)[0] as Effect);
  });

  // What CSS does not write stays where it was in the list.
  current.forEach((effect, index) => {
    if (!covered.has(effect.type) || !(effect.visible ?? true)) {
      merged.splice(Math.min(index, merged.length), 0, effect);
    }
  });

  return merged;
}

/** The parts of an effect CSS writes, rounded as it writes them: equal keys look the same in a read. */
export function effectKey(effect: Effect): string {
  const shadow = effect as Partial<DropShadowEffect>;
  const round = (value: number | undefined) => Math.round((value ?? 0) * 1_000);

  return JSON.stringify([
    effect.type,
    round((effect as { radius?: number }).radius),
    round(shadow.spread),
    round(shadow.offset?.x),
    round(shadow.offset?.y),
    shadow.color === undefined
      ? null
      : [shadow.color.r, shadow.color.g, shadow.color.b, shadow.color.a].map((channel) => Math.round(channel * 255)),
  ]);
}

/** Shadows and blurs as Figma holds them, in Figma's order. */
export function effectsOf(specs: readonly EffectSpec[]): Effect[] {
  return specs.map((effect): Effect => {
    if (!("color" in effect)) {
      return {
        type: effect.type,
        radius: effect.radius,
        visible: true,
        blurType: "NORMAL",
      };
    }

    return {
      type: effect.type,
      color: { ...effect.color },
      offset: {
        x: effect.x,
        y: effect.y,
      },
      radius: effect.radius,
      // Figma takes a spread only on boxes that clip their fill: a 0 is left out.
      ...(effect.spread === 0 ? {} : { spread: effect.spread }),
      visible: true,
      blendMode: "NORMAL",
    };
  });
}

/**
 * Dev Mode annotations, the whole list design_read shows, each category found by its label (made when the file lacks
 * it). A note that comes back as it was keeps its formatting and pinned properties; notes without text, which
 * design_read cannot show, stay.
 */
async function notesStep(node: Layer, { notes }: FigmaProps): Promise<void> {
  const categories = new Map(
    (await figma.annotations.getAnnotationCategoriesAsync()).map((category) => [
      category.label.toLowerCase(),
      category.id,
    ]),
  );
  const before = Array.isArray(node.annotations) ? (node.annotations as Annotation[]) : [];
  const textOf = (annotation: Annotation) => annotation.label ?? annotation.labelMarkdown ?? "";
  const unused = before.filter((annotation) => textOf(annotation) !== "");
  const annotations: Annotation[] = [];

  for (const { category, label } of notes ?? []) {
    let id = category === null ? undefined : categories.get(category.toLowerCase());

    if (category !== null && id === undefined) {
      id = (
        await figma.annotations.addAnnotationCategoryAsync({
          label: category,
          color: "blue",
        })
      ).id;
      categories.set(category.toLowerCase(), id);
    }

    const at = unused.findIndex((annotation) => textOf(annotation) === label);
    const kept = at === -1 ? undefined : unused.splice(at, 1)[0];
    const { categoryId: _category, ...rest } = kept ?? { label };

    annotations.push({
      ...rest,
      ...(id === undefined ? {} : { categoryId: id }),
    });
  }

  node.annotations = [...annotations, ...before.filter((annotation) => textOf(annotation) === "")];
}

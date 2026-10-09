import {
  type ApplyChange,
  type ApplyError,
  BridgeError,
  type FigmaProps,
  type LengthValue,
  type OperationInput,
  type OperationOutput,
  type PaintSpec,
} from "@pixelwright/core";
import type { Layer, TextLayer, WriteContext } from "../types/apply.ts";
import { errorMessage } from "../utils/error-message.ts";
import { STEPS, set } from "./apply-props.ts";
import { hasTextProps, writeText } from "./apply-text.ts";
import { requireEdits } from "./edits.ts";
import { fontKey, fontNameOf } from "./fonts.ts";
import { pageOf } from "./nodes.ts";
import { type TokenIndex, tokenIndex } from "./token-index.ts";
import { WriteError } from "./write-error.ts";

const MAKERS: Readonly<Record<string, () => SceneNode>> = {
  Frame: () => figma.createFrame(),
  Section: () => figma.createSection(),
  Text: () => figma.createText(),
  Rectangle: () => figma.createRectangle(),
  Ellipse: () => figma.createEllipse(),
  Line: () => figma.createLine(),
};

/** The font a new text starts with: loaded before its characters are set. */
const NEW_TEXT_FONT: FontName = {
  family: "Inter",
  style: "Regular",
};

/** Room left between the page's layers and a new one placed beside them. */
const PAGE_GAP = 100;

/**
 * design_apply's changes written in Figma: each element on its own, so one that fails leaves the others; creates go
 * parent first, after the element before them in the XML; one undo step for the call. Refused while Allow edits is
 * off; a dry run checks ids, parents, tokens and fonts and writes nothing.
 */
export async function apply({ changes, parent, dryRun }: OperationInput<"apply">): Promise<OperationOutput<"apply">> {
  if (!dryRun) {
    requireEdits();
  }

  const top = parent === undefined ? null : await layerOf(parent);
  const context = await prepare(changes, dryRun);
  const errors: ApplyError[] = [];
  const created: OperationOutput<"apply">["created"] = [];
  const changed: string[] = [];
  const nodes = new Map<string, Layer | null>();

  for (const change of changes) {
    const fail = (error: unknown, attribute?: string) => errors.push(errorOf(change, error, attribute));

    try {
      if (dryRun) {
        await check(change, nodes, context, fail);
        continue;
      }

      const node = change.kind === "update" ? await existing(change) : await create(change, changes, nodes, top);

      nodes.set(change.ref, node);

      const wrote = await write(node, change, context, fail);

      if (change.kind === "create") {
        finish(node, change.props);
        created.push({
          line: change.line,
          ref: change.ref,
          id: node.id,
          tag: change.tag,
        });
      } else if (wrote) {
        changed.push(node.id);
      }
    } catch (error) {
      fail(error);
    }
  }

  if (created.length > 0 || changed.length > 0) {
    figma.commitUndo();
  }

  return {
    created,
    changed,
    errors,
  };
}

function errorOf(change: ApplyChange, error: unknown, attribute?: string): ApplyError {
  const hint = error instanceof WriteError ? error.hint : undefined;

  return {
    line: change.line,
    column: change.column,
    ...(change.id === null ? {} : { id: change.id }),
    ...(attribute === undefined ? {} : { attribute }),
    message: errorMessage(error),
    ...(hint === undefined ? {} : { hint }),
  };
}

async function layerOf(id: string): Promise<Layer> {
  const node = await figma.getNodeByIdAsync(id);

  if (node === null || node.type === "DOCUMENT") {
    throw new BridgeError("NODE_NOT_FOUND", `No layer ${id} in this file to put the new layers in.`);
  }

  return node as unknown as Layer;
}

/** Every font the changes ask for, found and loaded up front, with the fonts of the texts they change. */
async function prepare(changes: readonly ApplyChange[], dryRun: boolean): Promise<WriteContext> {
  let index: Promise<TokenIndex> | null = null;
  const tokens = () => {
    index ??= tokenIndex();

    return index;
  };
  const fonts = new Map<string, FontName | WriteError>();
  const wanted: FontName[] = [];

  for (const change of changes) {
    for (const props of [change.props, ...(change.text?.runs ?? []).map((run) => run.props)]) {
      if (props.font !== undefined && !fonts.has(fontKey(props.font))) {
        const font = await fontNameOf(props.font).catch((error: unknown) =>
          error instanceof WriteError ? error : new WriteError(errorMessage(error)),
        );

        fonts.set(fontKey(props.font), font);

        if (!(font instanceof WriteError)) {
          wanted.push(font);
        }
      }

      if (props.textStyle !== undefined && props.textStyle !== "") {
        wanted.push(...(await styleFonts(await tokens(), props.textStyle)));
      }
    }

    if (change.kind === "create" && change.tag === "Text") {
      wanted.push(NEW_TEXT_FONT);
    }

    if (change.kind === "update" && change.id !== null && (change.text !== undefined || hasTextProps(change.props))) {
      const node = await figma.getNodeByIdAsync(change.id);

      if (node?.type === "TEXT") {
        wanted.push(...currentFonts(node));
      }
    }
  }

  const unloaded = new Set<string>();

  if (!dryRun) {
    const unique = new Map(wanted.map((font) => [`${font.family} ${font.style}`, font]));

    await Promise.all([...unique].map(([key, font]) => figma.loadFontAsync(font).catch(() => unloaded.add(key))));
  }

  return {
    tokens,
    fonts,
    unloaded,
  };
}

async function styleFonts(index: TokenIndex, name: string): Promise<FontName[]> {
  try {
    const style = await figma.getStyleByIdAsync(index.textStyle(name));

    return style?.type === "TEXT" ? [(style as TextStyle).fontName] : [];
  } catch {
    // An unknown style is the textStyle step's error.
    return [];
  }
}

function currentFonts(node: TextNode): FontName[] {
  if (node.characters.length > 0) {
    return node.getRangeAllFontNames(0, node.characters.length);
  }

  return node.fontName === figma.mixed ? [] : [node.fontName];
}

async function existing(change: ApplyChange, load = true): Promise<Layer> {
  const node = change.id === null ? null : await figma.getNodeByIdAsync(change.id);

  if (node === null || node.type === "PAGE" || node.type === "DOCUMENT") {
    throw new WriteError(`No layer ${change.id} in this file.`, "Read the ids again with design_read or nodes_find.");
  }

  if ((change.tag === "Text") !== (node.type === "TEXT")) {
    throw new WriteError(
      `${change.id} is a ${node.type.toLowerCase()}, not a ${change.tag}.`,
      "Check the id: the tag is the layer's type as design_read writes it.",
    );
  }

  const page = pageOf(node);

  if (load && page !== null && page !== figma.currentPage) {
    // dynamic-page: a page the user is not on has its layers once loaded.
    await page.loadAsync();
  }

  return node as unknown as Layer;
}

async function create(
  change: ApplyChange,
  changes: readonly ApplyChange[],
  nodes: ReadonlyMap<string, Layer | null>,
  top: Layer | null,
): Promise<Layer> {
  const make = MAKERS[change.tag];

  if (make === undefined) {
    throw new WriteError(`Creating a ${change.tag} is not available yet.`);
  }

  const { parent, index } = await whereTo(change, changes, nodes, top);

  if (typeof parent.insertChild !== "function") {
    throw new WriteError(`A ${parent.type.toLowerCase()} holds no layers: put the new one in a frame.`);
  }

  const node = make() as unknown as Layer;

  try {
    parent.insertChild(index, node);
  } catch (error) {
    (node as unknown as SceneNode).remove();

    throw error;
  }

  fresh(node, change.props);

  return node;
}

/** Where a create goes: next to the layer before/after names, else in its parent element, the call's, or the page. */
async function whereTo(
  change: ApplyChange,
  changes: readonly ApplyChange[],
  nodes: ReadonlyMap<string, Layer | null>,
  top: Layer | null,
): Promise<{ parent: Layer; index: number }> {
  const neighbour = change.before ?? change.after;

  if (change.parent === null && neighbour !== undefined) {
    const sibling = (await figma.getNodeByIdAsync(neighbour)) as unknown as Layer | null;

    if (sibling?.parent === null || sibling === null) {
      throw new WriteError(`No layer ${neighbour} to put the new one next to.`);
    }

    const at = indexIn(sibling.parent, sibling);

    return {
      parent: sibling.parent,
      index: change.before === undefined ? at + 1 : at,
    };
  }

  const parent = change.parent === null ? (top ?? (figma.currentPage as unknown as Layer)) : nodes.get(change.parent);

  if (parent === undefined || parent === null) {
    throw new WriteError("Its parent element was not written: fix the parent's error first.");
  }

  return {
    parent,
    index: await indexAmong(change, changes, nodes, parent),
  };
}

function indexIn(parent: Layer, child: Layer): number {
  return (parent.children ?? []).findIndex((node) => node.id === child.id);
}

/** After the element before it in the XML, else before the existing layer after it, else last. */
async function indexAmong(
  change: ApplyChange,
  changes: readonly ApplyChange[],
  nodes: ReadonlyMap<string, Layer | null>,
  parent: Layer,
): Promise<number> {
  const siblings = changes.filter((other) => other.parent === change.parent);
  const at = siblings.indexOf(change);

  // The plugin's sandbox may lack ES2023's toReversed: a copy reversed in place.
  for (const before of siblings.slice(0, at).reverse()) {
    const node = nodes.get(before.ref);

    if (node !== undefined && node !== null && node.parent?.id === parent.id) {
      return indexIn(parent, node) + 1;
    }
  }

  for (const after of siblings.slice(at + 1)) {
    const node =
      after.kind === "update" && after.id !== null
        ? ((await figma.getNodeByIdAsync(after.id)) as unknown as Layer | null)
        : null;

    if (node !== null && node.parent?.id === parent.id) {
      return indexIn(parent, node);
    }
  }

  return parent.children?.length ?? 0;
}

/** What the XML leaves out a new layer does not have: no fill without a background, no clipping without overflow. */
function fresh(node: Layer, props: FigmaProps): void {
  if (props.fills === undefined && node.type !== "TEXT" && node.type !== "LINE") {
    node.fills = [];
  }

  if (props.strokes === undefined && node.type === "LINE") {
    node.strokes = [];
  }

  if (props.clipsContent === undefined && node.type === "FRAME") {
    node.clipsContent = false;
  }

  if (node.type === "TEXT") {
    node.textAutoResize = "WIDTH_AND_HEIGHT";
  }
}

/** A new auto layout frame hugs what the XML did not size; a new layer on the page goes beside what is there. */
function finish(node: Layer, props: FigmaProps): void {
  const parent = node.parent;
  const direction = parent?.layoutMode;

  if (typeof node.layoutMode === "string" && node.layoutMode !== "NONE") {
    const fills = (axis: "horizontal" | "vertical") =>
      ((props.grow ?? false) && direction === (axis === "horizontal" ? "HORIZONTAL" : "VERTICAL")) ||
      (props.alignSelf === "STRETCH" && direction === (axis === "horizontal" ? "VERTICAL" : "HORIZONTAL")) ||
      props[axis]?.kind === "STRETCH" ||
      props[axis]?.kind === "SCALE";

    if (props.width === undefined && !fills("horizontal")) {
      set(node, "layoutSizingHorizontal", "HUG");
    }

    if (props.height === undefined && !fills("vertical")) {
      set(node, "layoutSizingVertical", "HUG");
    }
  }

  if (parent?.type === "PAGE" && props.horizontal === undefined) {
    const others = (parent.children ?? []).filter((child) => child.id !== node.id);
    const right = Math.max(...others.map((child) => (child.x as number) + child.width), -PAGE_GAP);

    node.x = Math.round(right + PAGE_GAP);
    node.y = Math.round(Math.min(...others.map((child) => child.y as number), 0));
  }
}

/** One change's properties, step by step, then its text; each step's error names its attribute. */
async function write(
  node: Layer,
  change: ApplyChange,
  context: WriteContext,
  fail: (error: unknown, attribute?: string) => void,
): Promise<boolean> {
  let wrote = false;
  const source = (keys: readonly (keyof FigmaProps)[]) =>
    keys.map((key) => change.sources[key]).find((attribute) => attribute !== undefined) ?? keys[0];

  for (const step of STEPS) {
    if (
      !step.keys.some((key) => change.props[key] !== undefined) ||
      (step.keys[0] === "hyperlink" && node.type === "TEXT")
    ) {
      continue;
    }

    try {
      await step.write(node, change.props, context);
      wrote = true;
    } catch (error) {
      fail(error, source(step.keys));
    }
  }

  if (node.type === "TEXT") {
    const text = await writeText(node as TextLayer, change, context, (key, error) =>
      fail(error, key === "text" ? undefined : source([key])),
    );

    wrote ||= text;
  } else if (change.text !== undefined || hasTextProps(change.props)) {
    fail(new WriteError(`A ${node.type.toLowerCase()} holds no text: text and its styles go on a Text inside it.`));
  }

  return wrote;
}

/** A dry run: the layer or the parent exists, and every token and font the change names is there. */
async function check(
  change: ApplyChange,
  nodes: Map<string, Layer | null>,
  context: WriteContext,
  fail: (error: unknown, attribute?: string) => void,
): Promise<void> {
  if (change.kind === "update") {
    nodes.set(change.ref, await existing(change, false));
  } else if (MAKERS[change.tag] === undefined) {
    throw new WriteError(`Creating a ${change.tag} is not available yet.`);
  } else if (change.parent !== null && !nodes.has(change.parent)) {
    throw new WriteError("Its parent element was not written: fix the parent's error first.");
  } else {
    nodes.set(change.ref, null);
  }

  for (const props of [change.props, ...(change.text?.runs ?? []).map((run) => run.props)]) {
    const font = props.font === undefined ? undefined : context.fonts.get(fontKey(props.font));

    if (font instanceof WriteError) {
      fail(font, change.sources.font ?? "font");
    }

    for (const [key, resolve] of tokensIn(props)) {
      try {
        await resolve(await context.tokens());
      } catch (error) {
        fail(error, change.sources[key] ?? key);
      }
    }
  }
}

type Resolve = (index: TokenIndex) => Promise<unknown>;

/** Every token a change's properties name, with how it resolves. */
function tokensIn(props: FigmaProps): [keyof FigmaProps, Resolve][] {
  const found: [keyof FigmaProps, Resolve][] = [];
  const length = (key: keyof FigmaProps, value: LengthValue | "HUG" | null | undefined) => {
    if (typeof value === "object" && value !== null) {
      found.push([key, (index) => index.variable(value.token, "FLOAT")]);
    }
  };
  const paints = (key: keyof FigmaProps, specs: readonly PaintSpec[] | undefined) => {
    for (const spec of specs ?? []) {
      if (spec.kind === "token") {
        found.push([
          key,
          async (index) => index.style(spec.token, "PAINT") ?? (await index.variable(spec.token, "COLOR")),
        ]);
      }
    }
  };

  for (const key of [
    "itemSpacing",
    "counterAxisSpacing",
    "gridColumnGap",
    "gridRowGap",
    "width",
    "height",
    "minWidth",
    "maxWidth",
    "minHeight",
    "maxHeight",
  ] as const) {
    length(key, props[key]);
  }

  for (const value of props.padding ?? []) {
    length("padding", value);
  }

  for (const value of Array.isArray(props.cornerRadius) ? props.cornerRadius : [props.cornerRadius]) {
    length("cornerRadius", value as LengthValue | undefined);
  }

  paints("fills", props.fills);
  paints("strokes", props.strokes?.paints);
  paints("textFills", props.textFills);

  const effects = props.effects;

  if (effects !== undefined && !Array.isArray(effects)) {
    const token = (effects as { token: string }).token;

    found.push([
      "effects",
      async (index) => {
        if (index.style(token, "EFFECT") === null) {
          throw new WriteError(`No effect style is named ${token} in this file or the libraries its page uses.`);
        }
      },
    ]);
  }

  if (props.textStyle !== undefined && props.textStyle !== "") {
    const name = props.textStyle;

    found.push(["textStyle", async (index) => index.textStyle(name)]);
  }

  return found;
}

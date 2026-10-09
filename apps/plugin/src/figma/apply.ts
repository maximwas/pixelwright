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
import type { KnownFont, Layer, TextLayer, WriteContext } from "../types/apply.ts";
import { errorMessage } from "../utils/error-message.ts";
import {
  fileName,
  fitIcon,
  imageOf,
  insideInstance,
  pairCopy,
  pairInstance,
  pathOf,
  svgOf,
  writeImage,
} from "./apply-assets.ts";
import {
  bindProperties,
  componentIndex,
  layOut,
  setProps,
  setVariant,
  swapTo,
  variantFor,
  variantName,
} from "./apply-components.ts";
import { STEPS, set } from "./apply-props.ts";
import { hasTextProps, writeText } from "./apply-text.ts";
import { requireEdits } from "./edits.ts";
import { fontKey, fontNameOf } from "./fonts.ts";
import { pageOf } from "./nodes.ts";
import { type TokenIndex, tokenIndex } from "./token-index.ts";
import { dropUploads, uploaded } from "./uploads.ts";
import { WriteError } from "./write-error.ts";

const MAKERS: Readonly<Record<string, () => SceneNode>> = {
  Frame: () => figma.createFrame(),
  Section: () => figma.createSection(),
  Text: () => figma.createText(),
  Rectangle: () => figma.createRectangle(),
  Ellipse: () => figma.createEllipse(),
  Line: () => figma.createLine(),
  Component: () => figma.createComponent(),
  // A frame holds a new set's variants until they are combined into the set.
  ComponentSet: () => figma.createFrame(),
  // An image fills a rectangle; its file is written as its fill.
  Image: () => figma.createRectangle(),
};

/** The font a new text starts with: loaded before its characters are set. */
const NEW_TEXT_FONT: FontName = {
  family: "Inter",
  style: "Regular",
};

/** Room left between the page's layers and a new one placed beside them. */
const PAGE_GAP = 100;

/** A new set waiting for its variants: the frame holding them until they are combined. */
interface Pending {
  readonly change: ApplyChange;
  readonly holder: Layer;
  readonly fail: (error: unknown, attribute?: string) => void;
}

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
  const byRef = new Map(changes.map((change) => [change.ref, change]));
  /** Each copy's and new instance's layers, by its ref and the layer an element inside it names. */
  const copies = new Map<string, BaseNode>();
  /** On a dry run, what the XML makes for the instances after it: components by name, a set with its variants. */
  const planned = new Map<string, Record<string, string>[] | null>();
  const sets: Pending[] = [];
  /**
   * New sets whose XML has ended (none holds `next`), combined from their variants, laid out and written; then the
   * properties their components' layers make. A set still open waits, and the properties inside it with it.
   */
  const settle = async (next?: ApplyChange) => {
    const open = new Set(next === undefined ? [] : ancestorsOf(next, byRef));
    const ready = sets.filter(({ change }) => !open.has(change.ref));

    sets.splice(0, sets.length, ...sets.filter(({ change }) => open.has(change.ref)));

    for (const pending of ready) {
      const made = combine(pending);

      if (made === null) {
        continue;
      }

      nodes.set(pending.change.ref, made);

      try {
        await write(made, pending.change, context, pending.fail);
        layOut(made as unknown as ComponentSetNode);
        context.components.add(made as unknown as ComponentSetNode);
        created.push({
          line: pending.change.line,
          ref: pending.change.ref,
          id: made.id,
          tag: pending.change.tag,
        });
      } catch (error) {
        pending.fail(error);
      }
    }

    const waiting = new Set(sets.map(({ holder }) => holder.id));
    const marks = context.marks.splice(0);

    context.marks.push(...marks.filter(({ node }) => within(node, waiting)));
    bindProperties(marks.filter(({ node }) => !within(node, waiting)));
  };

  for (const change of changes) {
    const fail = (error: unknown, attribute?: string) => errors.push(errorOf(change, error, attribute));

    try {
      if (dryRun) {
        await check(change, nodes, planned, byRef, context, fail);
        continue;
      }

      if (change.kind === "create" && change.tag === "Instance" && change.copyOf === undefined) {
        // Components made earlier in the call are whole before an instance is made of one.
        await settle(change);
      }

      const node =
        change.source !== undefined
          ? await counterpart(change, nodes, copies, byRef, context)
          : change.kind === "update"
            ? await existing(change)
            : await create(change, changes, nodes, top, context);

      nodes.set(change.ref, node);

      if (change.copyOf !== undefined) {
        pairCopy(
          (await figma.getNodeByIdAsync(change.copyOf)) as BaseNode,
          node as unknown as BaseNode,
          copies,
          change.ref,
        );
      } else if (change.kind === "create" && change.tag === "Instance") {
        pairInstance(node as unknown as BaseNode, copies, change.ref);
      }

      let moved = false;

      if (change.move ?? false) {
        // A layer that cannot go there keeps its place; its attributes are still written.
        try {
          await moveTo(node, change, changes, nodes, top);
          moved = true;
        } catch (error) {
          fail(error, change.before === undefined ? (change.after === undefined ? undefined : "after") : "before");
        }
      }

      if (change.kind === "create" && change.tag === "ComponentSet" && change.copyOf === undefined) {
        sets.push({
          change,
          holder: node,
          fail,
        });
        continue;
      }

      const wrote = await write(node, change, context, fail);

      if (change.kind === "create") {
        finish(node, change);

        // A component or set made here is found by the instances after it; a variant is found through its set.
        if (
          node.type === "COMPONENT_SET" ||
          (node.type === "COMPONENT" && byRef.get(change.parent ?? "")?.tag !== "ComponentSet")
        ) {
          context.components.add(node as unknown as ComponentNode);
        }

        created.push({
          line: change.line,
          ref: change.ref,
          id: node.id,
          tag: change.tag,
        });
      } else if ((wrote || moved) && change.source === undefined) {
        changed.push(node.id);
      }
    } catch (error) {
      fail(error);
    }
  }

  if (!dryRun) {
    await settle();
  }

  if (created.length > 0 || changed.length > 0) {
    figma.commitUndo();
  }

  dropUploads(changes.flatMap(streamsOf));

  return {
    created,
    changed,
    errors,
  };
}

/** The refs of the elements holding a change, the nearest first. */
function ancestorsOf(change: ApplyChange, byRef: ReadonlyMap<string, ApplyChange>): string[] {
  const refs: string[] = [];

  for (let ref = change.parent; ref !== null; ref = byRef.get(ref)?.parent ?? null) {
    refs.push(ref);
  }

  return refs;
}

/** Whether a layer is inside one of these. */
function within(node: Layer, ids: ReadonlySet<string>): boolean {
  for (let up = node.parent; up !== null; up = up.parent) {
    if (ids.has(up.id)) {
      return true;
    }
  }

  return false;
}

/** A new set's variants combined where their holder is; the holder goes, and with it a set that fails. */
function combine({ holder, fail }: Pending): Layer | null {
  const variants = (holder.children ?? []).filter((child) => child.type === "COMPONENT");

  try {
    if (variants.length === 0 || holder.parent === null) {
      throw new WriteError("A <ComponentSet> is made of its <Component> variants: this one has none.");
    }

    const made = figma.combineAsVariants(
      variants as unknown as ComponentNode[],
      holder.parent as unknown as BaseNode & ChildrenMixin,
      indexIn(holder.parent, holder),
    );

    holder.remove();

    return made as unknown as Layer;
  } catch (error) {
    // Nothing half made stays: the holder goes, with the variants it holds.
    if (holder.parent !== null) {
      holder.remove();
    }

    fail(error);

    return null;
  }
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

  await loadPageOf(node);

  return node as unknown as Layer;
}

/** dynamic-page: a page the user is not on has its layers once loaded. */
async function loadPageOf(node: BaseNode): Promise<void> {
  const page = node.type === "PAGE" ? node : pageOf(node);

  if (page !== null && page !== figma.currentPage) {
    await page.loadAsync();
  }
}

/** Every font the changes ask for, found and loaded up front, with the fonts of the texts they change. */
async function prepare(changes: readonly ApplyChange[], dryRun: boolean): Promise<WriteContext> {
  let index: Promise<TokenIndex> | null = null;
  const tokens = () => {
    index ??= tokenIndex({ importing: !dryRun });

    return index;
  };
  const fonts = new Map<string, FontName | WriteError>();
  const wanted: FontName[] = [];
  const known: KnownFont[] = [];

  // A text being changed has its fonts loaded whatever changes (sizing it needs them too), and the fonts it uses are
  // the first choice for the weights design_read wrote: a copy's are its source's.
  for (const change of changes) {
    const id = change.kind === "update" ? (change.id ?? change.source ?? null) : (change.copyOf ?? null);
    const node = id === null ? null : await figma.getNodeByIdAsync(id);

    if (node?.type === "TEXT") {
      wanted.push(...currentFonts(node));
      known.push(...knownFonts(node));
    } else if (change.kind === "create" && change.copyOf === undefined && change.tag === "Text") {
      wanted.push(NEW_TEXT_FONT);
    }
  }

  for (const change of changes) {
    for (const props of [change.props, ...(change.text?.runs ?? []).map((run) => run.props)]) {
      if (props.font !== undefined && !fonts.has(fontKey(props.font))) {
        const font = await fontNameOf(props.font, known).catch((error: unknown) =>
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
    uploads: uploaded,
    images: new Map(),
    components: componentIndex(),
    marks: [],
  };
}

async function styleFonts(index: TokenIndex, name: string): Promise<FontName[]> {
  try {
    const style = await figma.getStyleByIdAsync(await index.textStyle(name));

    return style?.type === "TEXT" ? [(style as TextStyle).fontName] : [];
  } catch {
    // An unknown style is the textStyle step's error.
    return [];
  }
}

function knownFonts(node: TextNode): KnownFont[] {
  if (node.characters.length === 0) {
    return node.fontName === figma.mixed || node.fontWeight === figma.mixed
      ? []
      : [
          {
            fontName: node.fontName,
            weight: node.fontWeight,
          },
        ];
  }

  return node.getStyledTextSegments(["fontName", "fontWeight"]).map((segment) => ({
    fontName: segment.fontName,
    weight: segment.fontWeight,
  }));
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
  context: WriteContext,
): Promise<Layer> {
  const { parent, index } = await whereTo(change, changes, nodes, top);

  if (typeof parent.insertChild !== "function") {
    throw new WriteError(`A ${parent.type.toLowerCase()} holds no layers: put the new one in a frame.`);
  }

  const node = (await makeNode(change, parent, context)) as unknown as Layer;

  try {
    parent.insertChild(index, node);
  } catch (error) {
    (node as unknown as SceneNode).remove();

    throw error;
  }

  if (bare(change)) {
    fresh(node, change.props);
  }

  if (change.props.name === undefined && change.props.asset !== undefined) {
    node.name = fileName(change.props.asset.src);
  }

  return node;
}

/** A new layer: a copy of its source, an instance of its component, an icon from its SVG, a slot of its component. */
async function makeNode(change: ApplyChange, parent: Layer, context: WriteContext): Promise<SceneNode> {
  if (change.copyOf !== undefined) {
    const source = await figma.getNodeByIdAsync(change.copyOf);

    if (source === null || source.type === "PAGE" || source.type === "DOCUMENT") {
      throw new WriteError(
        `No layer ${change.copyOf} to copy.`,
        "copyOf names a layer by its id, as design_read writes it.",
      );
    }

    return (source as SceneNode).clone();
  }

  if (change.tag === "Instance") {
    return variantFor(
      await context.components.find(change.props.component ?? ""),
      change.props.variant ?? {},
    ).createInstance();
  }

  if (change.tag === "Icon") {
    return figma.createNodeFromSvg(svgOf(change.props));
  }

  if (change.tag === "Image") {
    // Its file first: one that did not come, or that Figma refuses, leaves no empty rectangle.
    imageOf(change.props, context);

    return figma.createRectangle();
  }

  if (change.tag === "Slot") {
    if (parent.type !== "COMPONENT") {
      throw new WriteError(
        "A slot is made in a component.",
        'In an instance, fill the slot it has: give its <Slot id="…"> new layers.',
      );
    }

    return (parent as unknown as ComponentNode).createSlot();
  }

  const make = MAKERS[change.tag];

  if (make === undefined) {
    throw new WriteError(`Creating a ${change.tag} is not available.`);
  }

  return make();
}

/** A layer inside a copy or a new instance: the counterpart there of the layer the element names. */
async function counterpart(
  change: ApplyChange,
  nodes: ReadonlyMap<string, Layer | null>,
  copies: ReadonlyMap<string, BaseNode>,
  byRef: ReadonlyMap<string, ApplyChange>,
  context: WriteContext,
): Promise<Layer> {
  const scope = change.copy ?? "";
  const inCopy = byRef.get(scope)?.copyOf !== undefined;

  if ((nodes.get(scope) ?? null) === null) {
    throw new WriteError(`The ${inCopy ? "copy" : "instance"} it is in was not made: fix that element's error first.`);
  }

  const node = copies.get(`${scope} ${inCopy ? change.source : pathOf(change.source ?? "")}`) as Layer | undefined;

  if (node === undefined) {
    throw inCopy
      ? new WriteError(
          `The copy has no layer for ${change.source}.`,
          "Inside a copy, name only layers of the copied one, where they are in it.",
        )
      : new WriteError(
          `The new instance has no layer for ${change.source}.`,
          "Inside a new instance, name its layers by another instance's ids of the same component and variant, or by the component's own.",
        );
  }

  // A text there exists only now: its fonts (an instance's are its component's) load before it is written.
  if (node.type === "TEXT") {
    for (const font of currentFonts(node as unknown as TextNode)) {
      await figma.loadFontAsync(font).catch(() => context.unloaded.add(`${font.family} ${font.style}`));
    }
  }

  return node;
}

/** An existing layer placed again as a create would be: into another parent, next to a layer, in another order. */
async function moveTo(
  node: Layer,
  change: ApplyChange,
  changes: readonly ApplyChange[],
  nodes: ReadonlyMap<string, Layer | null>,
  top: Layer | null,
): Promise<void> {
  if (insideInstance(node)) {
    throw new WriteError("A layer inside an instance comes from its component and stays where it is.");
  }

  const { parent, index } = await whereTo(change, changes, nodes, top);

  if (typeof parent.insertChild !== "function" || parent.type === "TEXT") {
    throw new WriteError(`A ${parent.type.toLowerCase()} holds no layers.`);
  }

  if (parent.type !== "SLOT" && (parent.type === "INSTANCE" || insideInstance(parent))) {
    throw new WriteError("Layers go into an instance only through its slots.");
  }

  for (let up: Layer | null = parent; up !== null; up = up.parent) {
    if (up.id === node.id) {
      throw new WriteError("A layer cannot go inside itself.");
    }
  }

  // Figma reads the index in the list as it is, the layer itself still in its place (checked live): the index of the
  // layer it goes before is the one to give, whichever way it moves.
  parent.insertChild(index, node);
}

/** Where a create goes: next to the layer before/after names, else in its parent element, the call's, or the page. */
async function whereTo(
  change: ApplyChange,
  changes: readonly ApplyChange[],
  nodes: ReadonlyMap<string, Layer | null>,
  top: Layer | null,
): Promise<{ parent: Layer; index: number }> {
  let parent: Layer | null = null;

  if (change.parent !== null) {
    parent = nodes.get(change.parent) ?? null;

    if (parent === null) {
      throw new WriteError("Its parent element was not written: fix the parent's error first.");
    }
  }

  const neighbour = change.before ?? change.after;

  if (neighbour !== undefined) {
    const sibling = (await figma.getNodeByIdAsync(neighbour)) as unknown as Layer | null;

    if (sibling?.parent === null || sibling === null) {
      throw new WriteError(`No layer ${neighbour} to put the new one next to.`);
    }

    if (parent !== null && sibling.parent.id !== parent.id) {
      throw new WriteError(`${neighbour} is not in this element's parent: before and after name a layer beside it.`);
    }

    await loadPageOf(sibling as unknown as BaseNode);

    const at = indexIn(sibling.parent, sibling);

    return {
      parent: sibling.parent,
      index: change.before === undefined ? at + 1 : at,
    };
  }

  const into = parent ?? top ?? (figma.currentPage as unknown as Layer);

  return {
    parent: into,
    index: await indexAmong(change, changes, nodes, into),
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

/** A layer made from nothing; a copy, an instance or a slot starts as its source, component or component's slot. */
function bare(change: ApplyChange): boolean {
  return change.copyOf === undefined && change.tag !== "Instance" && change.tag !== "Slot";
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

/**
 * A new auto layout frame hugs what the XML did not size (a copy or an instance keeps its own sizing); a new layer on
 * the page goes beside what is there.
 */
function finish(node: Layer, change: ApplyChange): void {
  const props = change.props;
  const parent = node.parent;
  const direction = parent?.layoutMode;

  if (bare(change) && typeof node.layoutMode === "string" && node.layoutMode !== "NONE") {
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
  const { component, variant, props, property } = change.props;

  if (change.props.asset !== undefined && change.tag !== "Icon") {
    try {
      writeImage(node, change.props, context);
      wrote = true;
    } catch (error) {
      fail(error, source(["asset"]));
    }
  }

  // A new icon is sized by scaling it with its vectors; a resize would leave them as they are.
  const stepped = change.tag === "Icon" && change.kind === "create" ? fitIcon(node, change.props) : change.props;
  // A new instance is made of its component and variant; an existing one or a copy swaps them. Then its properties.
  const made = change.kind === "create" && change.copyOf === undefined;
  const own: (readonly [keyof FigmaProps, () => Promise<void> | void])[] = [
    ...(node.type === "INSTANCE" && !made && component !== undefined
      ? [["component", () => swapTo(node, component, variant, context.components)] as const]
      : []),
    ...(node.type === "INSTANCE" && !made && component === undefined && variant !== undefined
      ? [["variant", () => setVariant(node, variant)] as const]
      : []),
    ...(node.type === "COMPONENT" && variant !== undefined
      ? [["variant", () => set(node, "name", variantName(variant))] as const]
      : []),
    ...(node.type !== "INSTANCE" && node.type !== "COMPONENT" && (component !== undefined || variant !== undefined)
      ? [
          [
            component === undefined ? "variant" : "component",
            () => {
              throw new WriteError(
                `A ${node.type.toLowerCase()} has no component: component and variant make an <Instance>.`,
              );
            },
          ] as const,
        ]
      : []),
    ...(props !== undefined ? [["props", () => setProps(node, props, context.components)] as const] : []),
  ];

  for (const [key, step] of own) {
    try {
      await step();
      wrote = true;
    } catch (error) {
      fail(error, source([key]));
    }
  }

  if (property !== undefined) {
    context.marks.push({
      node,
      property,
      fail: (error) => fail(error, source(["property"])),
    });
  }

  for (const step of STEPS) {
    if (
      !step.keys.some((key) => stepped[key] !== undefined) ||
      (step.keys[0] === "hyperlink" && node.type === "TEXT")
    ) {
      continue;
    }

    try {
      await step.write(node, stepped, context);
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
  planned: Map<string, Record<string, string>[] | null>,
  byRef: ReadonlyMap<string, ApplyChange>,
  context: WriteContext,
  fail: (error: unknown, attribute?: string) => void,
): Promise<void> {
  if (change.source !== undefined) {
    // A layer of a copy or a new instance: those are made on a real run.
    nodes.set(change.ref, null);
  } else if (change.kind === "update") {
    nodes.set(change.ref, await existing(change, false));
  } else if (change.copyOf !== undefined) {
    if ((await figma.getNodeByIdAsync(change.copyOf)) === null) {
      throw new WriteError(`No layer ${change.copyOf} to copy.`);
    }

    nodes.set(change.ref, null);
  } else if (change.tag === "Instance") {
    const name = change.props.component ?? "";
    const made = planned.get(name);

    // The component and variant it names, found without making anything: one this XML makes, or the file's. A library
    // one named by key is checked on a real run: finding it imports it, which writes to the file.
    if (made === undefined && !name.startsWith("key:")) {
      variantFor(await context.components.find(name), change.props.variant ?? {});
    } else if (made !== undefined && made !== null) {
      plannedVariant(name, made, change.props.variant ?? {});
    }

    nodes.set(change.ref, null);
  } else if (MAKERS[change.tag] === undefined && change.tag !== "Icon" && change.tag !== "Slot") {
    throw new WriteError(`Creating a ${change.tag} is not available.`);
  } else if (change.parent !== null && !nodes.has(change.parent)) {
    throw new WriteError("Its parent element was not written: fix the parent's error first.");
  } else {
    nodes.set(change.ref, null);
  }

  const neighbour = change.before ?? change.after;

  if (neighbour !== undefined && (await figma.getNodeByIdAsync(neighbour)) === null) {
    fail(
      new WriteError(`No layer ${neighbour} to put this one next to.`),
      change.before === undefined ? "after" : "before",
    );
  }

  plan(change, byRef, planned);

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

/**
 * On a dry run, what a create makes for the instances after it: a set by its name (its variants as they come), a lone
 * component by its; a copied one is there, its variants unknown.
 */
function plan(
  change: ApplyChange,
  byRef: ReadonlyMap<string, ApplyChange>,
  planned: Map<string, Record<string, string>[] | null>,
): void {
  const name = change.props.name;
  const holder = byRef.get(change.parent ?? "");

  if (change.kind !== "create") {
    return;
  }

  if (change.tag === "Component" && holder?.tag === "ComponentSet") {
    const set = holder.kind === "create" ? planned.get(holder.props.name ?? "") : undefined;

    set?.push({ ...(change.props.variant ?? {}) });
  } else if ((change.tag === "ComponentSet" || change.tag === "Component") && name !== undefined) {
    planned.set(name, change.tag === "ComponentSet" && change.copyOf === undefined ? [] : null);
  }
}

/** A variant of a set the XML makes: the one with these values, the rest its first variant's (the set's default). */
function plannedVariant(
  name: string,
  variants: readonly Record<string, string>[],
  wanted: Record<string, string>,
): void {
  const target = {
    ...variants[0],
    ...wanted,
  };

  if (!variants.some((values) => Object.entries(target).every(([key, value]) => values[key] === value))) {
    throw new WriteError(
      `${name} has no variant ${variantName(wanted)}: it has ${variants.map((values) => variantName(values)).join("; ")}.`,
    );
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
          async (index) => (await index.style(spec.token, "PAINT")) ?? (await index.variable(spec.token, "COLOR")),
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
        if ((await index.style(token, "EFFECT")) === null) {
          throw new WriteError(`No effect style is named ${token} in this file or the libraries its page uses.`);
        }
      },
    ]);
  }

  if (props.textStyle !== undefined && props.textStyle !== "") {
    const name = props.textStyle;

    found.push(["textStyle", async (index) => await index.textStyle(name)]);
  }

  return found;
}

/** The upload streams a change names: its asset's and its image paints'. */
function streamsOf(change: ApplyChange): string[] {
  const paints = [...(change.props.fills ?? []), ...(change.props.textFills ?? [])];

  return [
    change.props.asset?.stream,
    ...paints.map((paint) => (paint.kind === "image" ? paint.stream : undefined)),
  ].filter((stream): stream is string => stream !== undefined);
}

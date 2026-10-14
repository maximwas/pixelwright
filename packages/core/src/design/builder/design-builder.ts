import { interactionAttributes } from "../../css/interactions.ts";
import { motionSummary } from "../../css/motion.ts";
import { nodeCss } from "../../css-mapping/read-node.ts";
import { colorSpaceOf } from "../../kernel/color/color-space.ts";
import type { CssContext } from "../../types/css.ts";
import type { Snapshot, SnapshotNode } from "../../types/snapshot.ts";
import { tagFor } from "../../xml/tags.ts";
import { assetCss } from "../assets/asset-css.ts";
import { AssetPlanner } from "../assets/asset-planner.ts";
import { type Classified, classify, visibleChildren } from "../assets/classify.ts";
import { overrideWords } from "../overrides.ts";
import type { DesignAttribute, DesignElement, DesignTree } from "../tree.ts";
import type { DesignXmlOptions } from "../types.ts";
import { DEV_STATUS_WORDS } from "../vocabulary.ts";
import { componentAttributes, cutCount, noteOf, pinsOf, readOnlyOf, urlOf } from "./layer-attributes.ts";
import { ReadCatalogue } from "./read-catalogue.ts";
import { textContent } from "./text-content.ts";

/** Layer types design_read leaves out: they draw nothing. */
const INVISIBLE_TYPES: ReadonlySet<string> = new Set(["SLICE"]);

/** An attribute, or nothing when the layer has none of it. */
type MaybeAttribute = readonly [string, string | undefined];

/** How one layer is written: as itself, as an asset, or as the code a template renders for it. */
interface Form {
  readonly asset: Classified | null;
  /** The component a Code Connect template renders for an instance: its code goes with the read instead. */
  readonly code: string | undefined;
  /** Shown without children, to fit the read into maxChars. */
  readonly cut: boolean;
  /** At most this many children, or a text's first characters. */
  readonly limit: number | undefined;
}

/**
 * Builds the design tree of a snapshot: an element per shown layer with Figma's type as its tag (Image and Icon for
 * true assets), its metadata, the CSS of the mapping table and the read-only notes; with the tokens, text styles and
 * fonts it refers to and the files it plans.
 */
export class DesignBuilder {
  readonly #snapshot: Snapshot;
  readonly #options: DesignXmlOptions;
  readonly #context: CssContext;
  readonly #catalogue: ReadCatalogue;
  readonly #assets: AssetPlanner;
  readonly #truncated: string[] = [];

  constructor(snapshot: Snapshot, options: DesignXmlOptions) {
    this.#snapshot = snapshot;
    this.#options = options;
    this.#catalogue = new ReadCatalogue(snapshot.styles);
    this.#assets = new AssetPlanner(options);
    this.#context = {
      styles: snapshot.styles,
      variables: snapshot.variables,
      tokens: new Map(),
      root: snapshot.root,
      imageUrl: (node, paint) => this.#assets.background(node, paint),
      colorSpace: colorSpaceOf(snapshot.colorProfile),
    };
  }

  build(): DesignTree {
    const root = this.#element(this.#snapshot.root, null);

    return {
      root,
      tokens: Object.fromEntries([...this.#context.tokens].sort(([a], [b]) => a.localeCompare(b))),
      textStyles: this.#catalogue.textStyles(),
      fonts: this.#catalogue.fonts(),
      assets: this.#assets.assets(),
      truncated: this.#truncated,
    };
  }

  #element(node: SnapshotNode, parent: SnapshotNode | null): DesignElement | null {
    if (!node.visible || INVISIBLE_TYPES.has(node.type)) {
      return null;
    }

    const form = this.#formOf(node);
    const attributes = this.#attributes(node, parent, form);
    const shownWhole = form.asset === null && form.code === undefined;

    if (
      form.cut ||
      (node.type === "TEXT" && form.limit !== undefined) ||
      (shownWhole && cutCount(node, form.limit) !== undefined)
    ) {
      this.#truncated.push(node.id);
    }

    const tag = form.asset === null ? tagFor(node.type) : form.asset.kind === "icon" ? "Icon" : "Image";

    if (node.type === "TEXT" && form.asset === null) {
      return {
        id: node.id,
        tag,
        attributes,
        content: textContent(node, this.#context, this.#catalogue, form.limit),
        children: [],
      };
    }

    const children = shownWhole && !form.cut ? visibleChildren(node).slice(0, form.limit) : [];

    return {
      id: node.id,
      tag,
      attributes,
      content: null,
      children: children.flatMap((child) => this.#element(child, node) ?? []),
    };
  }

  #formOf(node: SnapshotNode): Form {
    // An instance its template renders is its code: no asset, no children.
    const code = node.type === "INSTANCE" ? this.#options.connected?.get(node.id) : undefined;

    return {
      asset: code !== undefined || this.#options.notAssets?.has(node.id) ? null : classify(node, this.#snapshot.root),
      code,
      cut: this.#options.cut?.has(node.id) ?? false,
      limit: this.#options.limits?.get(node.id),
    };
  }

  /** The element's attributes in their order: metadata, the CSS, then the read-only ones ($…). */
  #attributes(node: SnapshotNode, parent: SnapshotNode | null, form: Form): DesignAttribute[] {
    const css = this.#css(node, parent, form.asset);
    const attributes: MaybeAttribute[] = [
      ...this.#metadata(node, css.textStyle, form.asset),
      ...css.properties,
      ...this.#readOnly(node, form, css.readOnly),
    ];

    return attributes.filter((pair): pair is DesignAttribute => pair[1] !== undefined);
  }

  /** What the layer is: its id and name, its component, notes and status, its link, text style and file. */
  #metadata(node: SnapshotNode, textStyle: string | undefined, asset: Classified | null): MaybeAttribute[] {
    return [
      ["id", node.id],
      ["name", node.type === "TEXT" && node.name === node.text?.characters ? undefined : node.name],
      ...componentAttributes(node),
      ["description", node.description === "" ? undefined : node.description],
      ["note", noteOf(node)],
      ["$pins", pinsOf(node)],
      ["$override", overrideWords(node).join(", ") || undefined],
      ["$dev", node === this.#snapshot.root ? DEV_STATUS_WORDS[this.#snapshot.devStatus ?? ""] : undefined],
      ["href", node.href ?? (node.type === "TEXT" ? urlOf(node.text?.segments ?? []) : undefined)],
      ["textStyle", this.#catalogue.useTextStyle(textStyle)],
      ["src", asset === null ? undefined : this.#assets.plan(node, asset)],
    ];
  }

  /** What design_apply leaves alone: code, read-only CSS, the grid style, interactions, motion, what was cut. */
  #readOnly(node: SnapshotNode, form: Form, readOnly: readonly [string, string][]): MaybeAttribute[] {
    const clipped = node.type === "TEXT" && form.limit !== undefined;
    const whole = form.asset === null && form.code === undefined && !form.cut && !clipped;

    return [
      ["$code", form.code],
      ["$css", readOnlyOf(readOnly, form.asset !== null)],
      ["$grid-style", node.gridStyleId === undefined ? undefined : this.#snapshot.styles[node.gridStyleId]?.name],
      ...interactionAttributes(node.reactions ?? []),
      ["$motion", motionSummary(node, this.#context.colorSpace)],
      ["$children", whole ? cutCount(node, form.limit) : undefined],
      ["$truncated", form.cut || clipped ? "true" : undefined],
    ];
  }

  /**
   * The layer's CSS. An asset's own look is in its file: its fills plan no background, it keeps only its placement
   * (and an image its corners and outside shadows), and the tokens its kept CSS names are the only ones it adds.
   */
  #css(node: SnapshotNode, parent: SnapshotNode | null, asset: Classified | null) {
    if (asset === null) {
      return nodeCss(node, parent, this.#context);
    }

    const tokens = new Map<string, string>();
    const css = nodeCss(node, parent, {
      ...this.#context,
      tokens,
      imageUrl: () => "",
    });
    const properties = assetCss(node, parent, asset.kind, css.properties);

    for (const [, value] of properties) {
      for (const [, name] of value.matchAll(/var\((--[^)]+)\)/g)) {
        const token = name === undefined ? undefined : tokens.get(name);

        if (name !== undefined && token !== undefined) {
          this.#context.tokens.set(name, token);
        }
      }
    }

    return {
      ...css,
      properties,
    };
  }
}

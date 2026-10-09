import { INVISIBLE_TYPES } from "../constants/css.ts";
import { px } from "../css/format.ts";
import { nodeCss } from "../css/node-css.ts";
import { baseSegment, segmentCss, textStyleCss } from "../css/text.ts";
import type { CssContext } from "../types/css.ts";
import type { DesignRead, DesignSpan, DesignXmlOptions, PlannedAsset } from "../types/design.ts";
import type { Snapshot, SnapshotNode, SnapshotPaint, SnapshotStyle, TextSegment } from "../types/snapshot.ts";
import { slug } from "../utils/slug.ts";
import { type Classified, classify, visibleChildren } from "./classify.ts";
import { escapeAttribute } from "./escape.ts";
import { inlineText } from "./parse/entities.ts";
import { tagFor } from "./tags.ts";

const INDENT = "  ";

/**
 * What an exported asset keeps of its CSS: where it sits and how big it is. The file holds how it looks, its opacity,
 * blur and inner shadows included, so CSS must not apply them a second time.
 */
const PLACEMENT = new Set([
  "position",
  "left",
  "top",
  "width",
  "height",
  "min-width",
  "max-width",
  "min-height",
  "max-height",
  "flex",
  "align-self",
  "transform",
]);

/** An image render is clipped to its own box: corners, drop shadows and outlines outside it stay CSS around it. */
const IMAGE_KEEPS = new Set([...PLACEMENT, "border-radius", "box-shadow", "outline"]);

/** What a span writes when the text it sits in has a property it lacks. */
const SPAN_RESETS: Readonly<Record<string, string>> = {
  "letter-spacing": "0",
  "text-transform": "none",
  "text-decoration": "none",
};

/**
 * A snapshot as Pixelwright's XML: Figma's layer types as tags (Image and Icon for true assets), metadata, and the
 * CSS of the one mapping table; with the tokens, text styles and fonts it refers to and the assets it plans.
 */
export function designXml(snapshot: Snapshot, options: DesignXmlOptions = {}): DesignRead {
  return renderDesign(snapshot, options).read;
}

/** The read with the lines it is made of and where each layer sits in them (fitDesign measures branches with it). */
export function renderDesign(
  snapshot: Snapshot,
  options: DesignXmlOptions = {},
): { read: DesignRead; lines: readonly string[]; spans: ReadonlyMap<string, DesignSpan> } {
  const writer = new DesignWriter(snapshot, options);
  const read = writer.read();

  return {
    read,
    lines: writer.lines,
    spans: writer.spans,
  };
}

class DesignWriter {
  private readonly context: CssContext;
  readonly lines: string[] = [];
  readonly spans = new Map<string, DesignSpan>();
  private readonly truncated: string[] = [];
  private readonly assets: PlannedAsset[] = [];
  private readonly fileNames = new Set<string>();
  private readonly backgrounds = new Map<string, string>();
  private readonly textStyles = new Map<string, string>();
  private readonly fonts = new Map<string, Set<string>>();
  private readonly assetsPath: string;
  private readonly snapshot: Snapshot;
  private readonly options: DesignXmlOptions;

  constructor(snapshot: Snapshot, options: DesignXmlOptions) {
    this.snapshot = snapshot;
    this.options = options;
    this.assetsPath = options.assetsPath ?? "assets";
    this.context = {
      styles: snapshot.styles,
      variables: snapshot.variables,
      tokens: new Map(),
      root: snapshot.root,
      imageUrl: (node, paint) => this.background(node, paint),
    };
  }

  read(): DesignRead {
    this.write(this.snapshot.root, null, 0);

    return {
      xml: this.lines.join("\n"),
      tokens: sorted(this.context.tokens),
      textStyles: sorted(this.textStyles),
      fonts: Object.fromEntries(
        [...this.fonts].map(([family, weights]) => [
          family,
          [...weights].sort((a, b) => a.localeCompare(b, "en", { numeric: true })),
        ]),
      ),
      assets: this.assets,
      truncated: this.truncated,
    };
  }

  private write(node: SnapshotNode, parent: SnapshotNode | null, level: number): void {
    if (!node.visible || INVISIBLE_TYPES.has(node.type)) {
      return;
    }

    const start = this.lines.length;

    this.writeElement(node, parent, level);
    this.spans.set(node.id, {
      start,
      end: this.lines.length - 1,
      level,
      parent: parent?.id ?? null,
    });
  }

  private writeElement(node: SnapshotNode, parent: SnapshotNode | null, level: number): void {
    const isCut = this.options.cut?.has(node.id) ?? false;
    const limit = this.options.limits?.get(node.id);
    const clipped = node.type === "TEXT" && limit !== undefined;

    const indent = INDENT.repeat(level);
    const asset = classify(node, this.snapshot.root);
    const tag = asset === null ? tagFor(node.type) : asset.kind === "icon" ? "Icon" : "Image";
    const keeps = asset === null ? null : asset.kind === "icon" ? PLACEMENT : IMAGE_KEEPS;
    // An asset's own look is in its file: its fills plan no background, and the CSS it drops adds no tokens.
    const context: CssContext =
      keeps === null
        ? this.context
        : {
            ...this.context,
            tokens: new Map(),
            imageUrl: () => "",
          };
    const css = nodeCss(node, parent, context);
    const properties =
      keeps === null
        ? css.properties
        : assetPlacement(
            node,
            parent,
            asset?.kind ?? "image",
            css.properties.filter(([property]) => keeps.has(property)),
          );

    if (context !== this.context) {
      this.keepTokens(properties, context.tokens);
    }

    const attributes: [string, string | undefined][] = [
      ["id", node.id],
      ["name", node.type === "TEXT" && node.name === node.text?.characters ? undefined : node.name],
      ...this.componentOf(node),
      ["description", node.description === "" ? undefined : node.description],
      ["note", noteOf(node)],
      ["href", node.href ?? (node.type === "TEXT" ? urlOf(node.text?.segments ?? []) : undefined)],
      ["textStyle", this.useTextStyle(css.textStyle)],
      ["src", asset === null ? undefined : this.plan(node, asset)],
      ...properties,
      ["$css", readOnlyOf(css.readOnly, asset !== null)],
      ["$children", asset === null && !isCut && !clipped ? cutCount(node, limit) : undefined],
      ["$truncated", isCut || clipped ? "true" : undefined],
    ];

    if (isCut || clipped || (asset === null && cutCount(node, limit) !== undefined)) {
      this.truncated.push(node.id);
    }

    const open = `${indent}<${tag}${attributes
      .filter((pair): pair is [string, string] => pair[1] !== undefined)
      .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
      .join("")}`;

    if (node.type === "TEXT" && asset === null) {
      const content = clipped
        ? `${escapeText((node.text?.characters ?? "").slice(0, limit))}…`
        : this.textContent(node);

      this.lines.push(`${open}>${content}</${tag}>`);

      return;
    }

    const children = asset === null && !isCut ? visibleChildren(node).slice(0, limit) : [];

    if (children.length === 0) {
      this.lines.push(`${open}/>`);

      return;
    }

    this.lines.push(`${open}>`);

    for (const child of children) {
      this.write(child, node, level + 1);
    }

    this.lines.push(`${indent}</${tag}>`);
  }

  private keepTokens(properties: readonly [string, string][], tokens: ReadonlyMap<string, string>): void {
    for (const [, value] of properties) {
      for (const [, name] of value.matchAll(/var\((--[^)]+)\)/g)) {
        const token = name === undefined ? undefined : tokens.get(name);

        if (name !== undefined && token !== undefined) {
          this.context.tokens.set(name, token);
        }
      }
    }
  }

  private componentOf(node: SnapshotNode): [string, string | undefined][] {
    if (node.instance === undefined) {
      return [];
    }

    const { setName, componentName, properties } = node.instance;
    const listed = (types: ReadonlySet<string>) =>
      Object.entries(properties)
        .filter(([, property]) => types.has(property.type))
        // Figma suffixes a non-variant property's name with its id: "Label#12:0".
        .map(([name, property]) => `${listItem(name.replace(/#[^#]*$/, ""))}=${listItem(String(property.value))}`)
        .join(", ");
    const variant = listed(VARIANT_PROPERTY);
    const props = listed(OWN_PROPERTIES);

    return [
      ["component", setName ?? componentName],
      ["variant", setName === undefined || variant === "" ? undefined : variant],
      ["props", props === "" ? undefined : props],
    ];
  }

  /** The text's characters, runs that differ from its main one wrapped in spans. */
  private textContent(node: SnapshotNode): string {
    const segments = node.text?.segments ?? [];
    const base = baseSegment(segments);

    for (const segment of segments) {
      this.useFont(segment);
    }

    if (base === undefined || segments.length < 2) {
      return escapeText(node.text?.characters ?? "");
    }

    const baseCss = segmentCss(base, node, this.context, []);

    return segments
      .map((segment) => {
        if (segment === base) {
          return escapeText(segment.characters);
        }

        const own = segmentCss(segment, node, this.context, []);
        const differs: [string, string][] = [...own.css].filter(
          ([property, value]) => baseCss.css.get(property) !== value,
        );

        for (const property of baseCss.css.keys()) {
          const reset = SPAN_RESETS[property];

          if (!own.css.has(property) && reset !== undefined) {
            differs.push([property, reset]);
          }
        }

        const textStyle = own.textStyle === baseCss.textStyle ? undefined : this.useTextStyle(own.textStyle);
        const href = urlOf([segment]);
        const linked = href === urlOf([base]) ? undefined : href;

        if (differs.length === 0 && textStyle === undefined && linked === undefined) {
          return escapeText(segment.characters);
        }

        const attributes = [
          ...(textStyle === undefined ? [] : [["textStyle", textStyle]]),
          ...(linked === undefined ? [] : [["href", linked]]),
          ...differs,
        ]
          .map(([name, value]) => ` ${name}="${escapeAttribute(value ?? "")}"`)
          .join("");

        return `<Span${attributes}>${escapeText(segment.characters)}</Span>`;
      })
      .join("");
  }

  private useTextStyle(name: string | undefined): string | undefined {
    if (name === undefined) {
      return undefined;
    }

    const style = Object.values(this.snapshot.styles).find((candidate: SnapshotStyle) => candidate.name === name);
    const css = style === undefined ? null : textStyleCss(style);

    if (css !== null) {
      this.textStyles.set(name, css);
    }

    return name;
  }

  private useFont(segment: TextSegment): void {
    const italic = /italic/i.test(segment.fontName.style) ? " italic" : "";
    const weights = this.fonts.get(segment.fontName.family) ?? new Set<string>();

    weights.add(`${segment.fontWeight}${italic}`);
    this.fonts.set(segment.fontName.family, weights);
  }

  /** Plans a layer's file and returns the path the XML refers to. */
  private plan(node: SnapshotNode, asset: Classified): string {
    const extension = asset.format.toLowerCase();
    // An instance is named by its variant too: six "Company logo" instances are six different logos.
    const variants = Object.values(node.instance?.properties ?? {})
      .filter((property) => property.type === "VARIANT")
      .map((property) => String(property.value));
    const base = slug([node.name, ...variants].join(" "));
    const src = this.options.assetSrc?.get(node.id) ?? `${this.assetsPath}/${this.fileName(base, extension)}`;

    this.assets.push({
      node: node.id,
      kind: asset.kind,
      format: asset.format,
      src,
      ...(asset.scale === undefined ? {} : { scale: asset.scale }),
    });

    return src;
  }

  /** An image fill behind content: the original image, one file per image however many layers use it. */
  private background(node: SnapshotNode, paint: SnapshotPaint): string {
    const hash = paint.imageHash ?? node.id;
    const known = this.backgrounds.get(hash);

    if (known !== undefined) {
      return known;
    }

    const src =
      this.options.assetSrc?.get(`${node.id}#${hash}`) ??
      `${this.assetsPath}/${this.fileName(`${slug(node.name)}-background`, "png")}`;

    this.backgrounds.set(hash, src);
    this.assets.push({
      node: node.id,
      kind: "image",
      format: "PNG",
      src,
      ...(paint.imageHash === undefined || paint.imageHash === null ? {} : { imageHash: paint.imageHash }),
    });

    return src;
  }

  private fileName(base: string, extension: string): string {
    let name = `${base}.${extension}`;

    for (let index = 2; this.fileNames.has(name); index++) {
      name = `${base}-${index}.${extension}`;
    }

    this.fileNames.add(name);

    return name;
  }
}

const VARIANT_PROPERTY: ReadonlySet<string> = new Set(["VARIANT"]);

/** An instance's own settings: its texts and toggles (a swapped instance and a slot show as children). */
const OWN_PROPERTIES: ReadonlySet<string> = new Set(["TEXT", "BOOLEAN"]);

/** A name or value in a `Name=Value, …` list: backslash before the separators, so a value with them reads back whole. */
function listItem(text: string): string {
  return text.replace(/[\\,=]/g, (char) => `\\${char}`);
}

/** The designer's Dev Mode notes, each with its category, separated by ` | ` (a bar inside a note is escaped). */
function noteOf(node: SnapshotNode): string | undefined {
  const notes = (node.annotations ?? []).map(({ label, category }) =>
    (category === undefined ? label : `${category}: ${label}`).replace(/[\\|]/g, (char) => `\\${char}`),
  );

  return notes.length === 0 ? undefined : notes.join(" | ");
}

/** The URL every given run links to, if they all link to the same one. */
function urlOf(segments: readonly TextSegment[]): string | undefined {
  const urls = new Set(
    segments.map((segment) => (segment.hyperlink?.type === "URL" ? segment.hyperlink.value : undefined)),
  );
  const [url] = urls;

  return urls.size === 1 ? url : undefined;
}

/**
 * Where an asset's file goes. Figma exports a turned or mirrored layer already turned, so the asset takes the box it
 * covers and no transform; an icon is exported with what it draws outside its geometry (centred and outside strokes),
 * so it takes that box. An image keeps only its outside (drop) shadows: the inner ones are in the file.
 */
function assetPlacement(
  node: SnapshotNode,
  parent: SnapshotNode | null,
  kind: "icon" | "image",
  properties: [string, string][],
): [string, string][] {
  const outside = properties
    .map(([property, value]): [string, string] =>
      property === "box-shadow"
        ? [
            property,
            splitShadows(value)
              .filter((shadow) => !shadow.startsWith("inset"))
              .join(", "),
          ]
        : [property, value],
    )
    .filter(([, value]) => value !== "");
  const bounds = kind === "icon" ? (node.renderBounds ?? node.bounds) : node.bounds;

  if (bounds === undefined) {
    return outside;
  }

  const placed = new Map(outside.filter(([property]) => property !== "transform"));

  placed.set("width", px(bounds.width));
  placed.set("height", px(bounds.height));

  if (placed.has("left") && parent !== null) {
    placed.set("left", px(bounds.x - parent.x));
  }

  if (placed.has("top") && parent !== null) {
    placed.set("top", px(bounds.y - parent.y));
  }

  return outside
    .filter(([property]) => placed.has(property))
    .map(([property]) => [property, placed.get(property) ?? ""]);
}

/** A box-shadow list split at the commas between shadows, not those inside rgba(). */
function splitShadows(value: string): string[] {
  return value.split(/,(?![^(]*\))/).map((shadow) => shadow.trim());
}

/** The read-only CSS of a layer; an asset keeps only its blend mode, which no exported file holds. */
function readOnlyOf(readOnly: readonly [string, string][], isAsset: boolean): string | undefined {
  const kept = isAsset ? readOnly.filter(([property]) => property === "mix-blend-mode") : readOnly;

  return kept.length === 0 ? undefined : kept.map(([property, value]) => `${property}: ${value}`).join("; ");
}

/** How many children a layer has when the snapshot or the fit to maxChars did not list them all. */
function cutCount(node: SnapshotNode, limit?: number): string | undefined {
  const listed = Math.min(node.children?.length ?? 0, limit ?? Number.POSITIVE_INFINITY);

  return listed < node.childCount ? String(node.childCount) : undefined;
}

/** Text content that reads back the same: escaped, line breaks as references, spaces-only text kept. */
function escapeText(text: string): string {
  return inlineText(text);
}

function sorted(map: ReadonlyMap<string, string>): Record<string, string> {
  return Object.fromEntries([...map].sort(([a], [b]) => a.localeCompare(b)));
}

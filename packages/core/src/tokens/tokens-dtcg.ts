import {
  DTCG_AUTO_LINE_HEIGHT,
  DTCG_DIMENSION_SCOPES,
  DTCG_ROOT,
  DTCG_SHADOWS,
  DTCG_STYLES,
} from "../constants/tokens.ts";
import type { DtcgGroup, DtcgResult, DtcgToken, RawTokens } from "../types/tokens.ts";
import { weightOf } from "../utils/font-weight.ts";

type RawVariable = RawTokens["variables"][number];
type RawStyle = RawTokens["styles"][number];
type Rgba = { r: number; g: number; b: number; a?: number | undefined };

/**
 * The file's tokens in the Design Tokens Format (DTCG 2025.10): a tree per mode of each collection, keyed
 * `<collection>.<mode>` (the collection alone when it has one mode), and a `styles` tree. Paths come from the names'
 * "/" segments; a token whose path is also a group sits at the group's `$root`. What DTCG has no type for is named in
 * notes, never dropped silently.
 */
export function dtcgTrees(raw: RawTokens, filter: { collections?: readonly string[] } = {}): DtcgResult {
  const wanted = filter.collections?.map((name) => name.toLowerCase());
  const collections = raw.collections.filter(
    (collection) => wanted === undefined || wanted.includes(collection.name.toLowerCase()),
  );
  const included = new Set(collections.map((collection) => collection.id));
  const types = typesOf(raw);
  const refs = referencesOf(raw, types, included);
  const trees: Record<string, DtcgGroup> = {};
  const untyped = new Map<string, string>();
  const lost = new Set<string>();
  const outside = new Map<string, string>();
  const keys = new Set([DTCG_STYLES]);
  const renamed: string[] = [];

  for (const collection of collections) {
    const variables = raw.variables.filter((variable) => variable.collectionId === collection.id);
    const key = uniqueKey(slug(collection.name), keys);
    const modes = new Set<string>();

    if (key !== slug(collection.name)) {
      renamed.push(`The collection ${collection.name} is written as ${key}: ${slug(collection.name)} is taken.`);
    }

    for (const mode of collection.modes) {
      const tree: DtcgGroup = {};

      for (const variable of variables) {
        const type = types.get(variable.id) ?? null;

        if (type === null) {
          untyped.set(variable.name, variable.resolvedType);
          continue;
        }

        const value = variable.valuesByMode[mode.modeId];
        const alias = aliasOf(value);
        const reference = alias === null ? undefined : refs.get(alias);

        if (alias !== null && reference === undefined) {
          lost.add(variable.name);
          continue;
        }

        const elsewhere = alias === null ? null : outsideOf(raw, alias, included);

        if (elsewhere !== null) {
          outside.set(variable.name, `${variable.name} points at ${elsewhere}`);
        }

        const token: DtcgToken = {
          $type: type,
          $value: reference ?? dtcgValue(type, value),
          ...(variable.description === undefined || variable.description === ""
            ? {}
            : { $description: variable.description }),
        };

        put(tree, refs.location(variable.id), token);
      }

      trees[collection.modes.length === 1 ? key : `${key}.${uniqueKey(slug(mode.name), modes)}`] = tree;
    }
  }

  const styles = stylesTree(raw.styles);

  trees[DTCG_STYLES] = styles.tree;

  return {
    trees,
    notes: [
      ...renamed,
      ...refs.renamed,
      ...(untyped.size === 0
        ? []
        : [
            `${untyped.size} variable${untyped.size === 1 ? " has" : "s have"} no DTCG type and ${untyped.size === 1 ? "is" : "are"} left out: ${[...untyped].map(([name, type]) => `${name} (${type})`).join(", ")}.`,
          ]),
      ...[...lost].map(
        (name) => `${name} points at a variable that is neither in this file nor in a library it uses: left out.`,
      ),
      ...outside.values(),
      ...styles.notes,
    ],
  };
}

/**
 * Each variable's DTCG type: from its own type and scopes, then from the tokens it is linked with by an alias, so a
 * reference never points at a token left out or of another unit (a FLOAT for any field aliased by a gap is a dimension;
 * a text aliased by a font family is a font family).
 */
function typesOf(raw: RawTokens): Map<string, string | null> {
  const types = new Map(raw.variables.map((variable) => [variable.id, typeOf(variable)]));
  const links = raw.variables.flatMap((variable) =>
    Object.values(variable.valuesByMode).flatMap((value) => {
      const target = aliasOf(value);

      return target !== null && types.has(target) ? [[variable.id, target] as const] : [];
    }),
  );

  for (let changed = true; changed; ) {
    changed = false;

    for (const [a, b] of links) {
      for (const [weak, strong] of [
        [a, b],
        [b, a],
      ] as const) {
        const own = types.get(weak) ?? null;
        const other = types.get(strong) ?? null;

        if (other !== null && other !== own && (own === null || (own === "number" && other !== "number"))) {
          types.set(weak, other);
          changed = true;
        }
      }
    }
  }

  return types;
}

/** Where an alias's token lives when no tree here holds it: a collection left out, or a library. Null: in a tree. */
function outsideOf(raw: RawTokens, id: string, included: ReadonlySet<string>): string | null {
  const local = raw.variables.find((variable) => variable.id === id);

  if (local !== undefined) {
    const collection = raw.collections.find((candidate) => candidate.id === local.collectionId);

    return included.has(local.collectionId)
      ? null
      : `${local.name} in ${collection?.name ?? local.collectionId}, which this output leaves out: add it to collections for the reference to resolve.`;
  }

  const external = raw.external[id];

  return external === undefined
    ? null
    : `${external.name} from a library (${external.collection}): no file here defines it, so add that library's tokens for the reference to resolve.`;
}

/** Each typed variable's place in its collection's trees, and its alias reference (`{color.brand}`, `{color.brand.$root}`). */
function referencesOf(raw: RawTokens, types: ReadonlyMap<string, string | null>, included: ReadonlySet<string>) {
  const locations = new Map<string, string[]>();
  const renamed: string[] = [];

  for (const collection of raw.collections) {
    const variables = raw.variables.filter(
      (variable) => variable.collectionId === collection.id && (types.get(variable.id) ?? null) !== null,
    );
    const placed = placements(
      variables.map((variable) => ({
        id: variable.id,
        name: variable.name,
        path: pathOf(variable.name),
      })),
      included.has(collection.id) ? renamed : [],
    );

    for (const [id, path] of placed) {
      locations.set(id, path);
    }
  }

  const references = new Map<string, string>();

  for (const [id, path] of locations) {
    references.set(id, `{${path.join(".")}}`);
  }

  for (const [id, external] of Object.entries(raw.external)) {
    if (!references.has(id)) {
      references.set(id, `{${pathOf(external.name).join(".")}}`);
    }
  }

  return {
    get: (id: string) => references.get(id),
    location: (id: string) => locations.get(id) ?? [],
    renamed,
  };
}

/**
 * Where each named thing goes: its path, suffixed when an earlier one took it (named in `renamed`), or its path's
 * `$root` when another path continues under it.
 */
function placements(
  entries: readonly { id: string; name: string; path: string[] }[],
  renamed: string[],
): Map<string, string[]> {
  const taken = new Set<string>();
  const unique = entries.map(({ id, name, path }) => {
    let placed = path;

    for (let index = 2; taken.has(placed.join("/")); index++) {
      placed = [...path.slice(0, -1), `${path.at(-1) ?? ""}-${index}`];
    }

    if (placed !== path) {
      renamed.push(`${name} has the same DTCG path as another token: written as ${placed.join(".")}.`);
    }

    taken.add(placed.join("/"));

    return [id, placed] as const;
  });
  const groups = new Set<string>();

  for (const [, path] of unique) {
    for (let length = 1; length < path.length; length++) {
      groups.add(path.slice(0, length).join("/"));
    }
  }

  return new Map(unique.map(([id, path]) => [id, groups.has(path.join("/")) ? [...path, DTCG_ROOT] : path]));
}

/** A key not taken yet: suffixed -2, -3… when it is. Takes it. */
function uniqueKey(key: string, taken: Set<string>): string {
  let unique = key;

  for (let index = 2; taken.has(unique); index++) {
    unique = `${key}-${index}`;
  }

  taken.add(unique);

  return unique;
}

function put(tree: DtcgGroup, path: readonly string[], token: DtcgToken): void {
  let group = tree;

  for (const segment of path.slice(0, -1)) {
    const next = group[segment];

    if (next === undefined || "$type" in next) {
      group[segment] = {};
    }

    group = group[segment] as DtcgGroup;
  }

  const last = path.at(-1);

  if (last !== undefined) {
    group[last] = token;
  }
}

/** The DTCG type a variable's values take, from its type and scopes; null when DTCG has none. */
function typeOf(variable: RawVariable): string | null {
  const scopes = variable.scopes;

  switch (variable.resolvedType) {
    case "COLOR":
      return "color";
    case "FLOAT":
      if (scopes.length > 0 && scopes.every((scope) => DTCG_DIMENSION_SCOPES.has(scope))) {
        return "dimension";
      }

      return scopes.length > 0 && scopes.every((scope) => scope === "FONT_WEIGHT") ? "fontWeight" : "number";
    case "STRING":
      return scopes.length > 0 && scopes.every((scope) => scope === "FONT_FAMILY") ? "fontFamily" : null;
    default:
      return null;
  }
}

function dtcgValue(type: string, value: unknown): unknown {
  if (type === "color") {
    return isRgba(value) ? colorOf(value) : value;
  }

  if (type === "dimension") {
    return typeof value === "number" ? px(value) : value;
  }

  return value;
}

/** A Figma colour as DTCG writes one: sRGB components, alpha when see-through, and the hex fallback. */
function colorOf({ r, g, b, a = 1 }: Rgba, opacity = 1): Record<string, unknown> {
  const alpha = round(a * opacity);
  const hex = [r, g, b]
    .map((channel) =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

  return {
    colorSpace: "srgb",
    components: [round(r), round(g), round(b)],
    ...(alpha < 1 ? { alpha } : {}),
    hex: `#${hex.toUpperCase()}`,
  };
}

function stylesTree(styles: readonly RawStyle[]): { tree: DtcgGroup; notes: string[] } {
  const tree: DtcgGroup = {};
  const untyped: string[] = [];
  const autoLineHeight: string[] = [];
  const renamed: string[] = [];
  const placed = placements(
    styles.map((style) => ({
      id: style.id,
      name: style.name,
      path: pathOf(style.name),
    })),
    renamed,
  );

  for (const style of styles) {
    const token = styleToken(style, autoLineHeight);

    if (token === null) {
      untyped.push(`${style.name} (${style.type.toLowerCase()})`);
      continue;
    }

    put(tree, placed.get(style.id) ?? [], token);
  }

  return {
    tree,
    notes: [
      ...renamed,
      ...(untyped.length === 0
        ? []
        : [
            `${untyped.join(", ")}: no DTCG type for ${untyped.length === 1 ? "this style" : "these styles"}, left out.`,
          ]),
      ...(autoLineHeight.length === 0
        ? []
        : [
            `${autoLineHeight.join(", ")}: Auto line height, written as ${DTCG_AUTO_LINE_HEIGHT} (CSS's normal); give the style a line height in Figma to match exactly.`,
          ]),
    ],
  };
}

function styleToken(style: RawStyle, autoLineHeight: string[]): DtcgToken | null {
  if (style.type === "PAINT") {
    const paints = (style.paints ?? []).filter((paint) => paint.visible !== false);
    const [paint] = paints;

    if (paints.length !== 1 || paint === undefined) {
      return null;
    }

    if (paint.type === "SOLID" && isRgba(paint.color)) {
      return {
        $type: "color",
        $value: colorOf(paint.color, paint.opacity ?? 1),
      };
    }

    if (paint.type.startsWith("GRADIENT_") && paint.gradientStops !== undefined) {
      return {
        $type: "gradient",
        $value: paint.gradientStops.map((stop) => ({
          color: colorOf(stop.color),
          position: round(stop.position),
        })),
      };
    }

    return null;
  }

  if (style.type === "TEXT" && style.fontName !== undefined && style.fontSize !== undefined) {
    const size = style.fontSize;
    const lineHeight = style.lineHeight;

    if (lineHeight === undefined || lineHeight.unit === "AUTO" || lineHeight.value === undefined) {
      autoLineHeight.push(style.name);
    }

    return {
      $type: "typography",
      $value: {
        fontFamily: style.fontName.family,
        fontSize: px(size),
        fontWeight: weightOf(style.fontName.style),
        lineHeight:
          lineHeight?.value === undefined || lineHeight.unit === "AUTO"
            ? DTCG_AUTO_LINE_HEIGHT
            : round(lineHeight.unit === "PERCENT" ? lineHeight.value / 100 : lineHeight.value / size),
        letterSpacing: px(
          style.letterSpacing === undefined
            ? 0
            : style.letterSpacing.unit === "PERCENT"
              ? (style.letterSpacing.value * size) / 100
              : style.letterSpacing.value,
        ),
      },
    };
  }

  if (style.type === "EFFECT") {
    const effects = (style.effects ?? []).filter((effect) => effect.visible !== false);

    if (effects.length === 0 || !effects.every((effect) => effect.type in DTCG_SHADOWS)) {
      return null;
    }

    const shadows = effects.map((effect) => ({
      color: colorOf(
        isRgba(effect.color)
          ? effect.color
          : {
              r: 0,
              g: 0,
              b: 0,
              a: 0.25,
            },
      ),
      offsetX: px(effect.offset?.x ?? 0),
      offsetY: px(effect.offset?.y ?? 0),
      blur: px(effect.radius ?? 0),
      spread: px(effect.spread ?? 0),
      ...(DTCG_SHADOWS[effect.type] ? { inset: true } : {}),
    }));

    return {
      $type: "shadow",
      $value: shadows.length === 1 ? shadows[0] : shadows,
    };
  }

  return null;
}

/** A name's path: its "/" segments, each without what DTCG reserves (".", "{", "}" and a leading "$"). */
function pathOf(name: string): string[] {
  return name
    .split("/")
    .map((segment) => segment.trim().replace(/[.{}]/g, "-").replace(/^\$+/, ""))
    .filter((segment) => segment !== "");
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

function px(value: number): { value: number; unit: "px" } {
  return {
    value: round(value),
    unit: "px",
  };
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function aliasOf(value: unknown): string | null {
  return typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "VARIABLE_ALIAS" &&
    typeof (value as { id?: unknown }).id === "string"
    ? (value as { id: string }).id
    : null;
}

function isRgba(value: unknown): value is Rgba {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Rgba).r === "number" &&
    typeof (value as Rgba).g === "number" &&
    typeof (value as Rgba).b === "number"
  );
}

import { BridgeError, type OperationInput, type OperationOutput } from "@pixelwright/core";
import { OP_BUDGET_MS, USAGE_MAX_LAYERS } from "../../constants/plugin.ts";
import { requireNode } from "../../figma/nodes.ts";
import { type StyleKind, TokenIndex } from "../../figma/tokens/token-index.ts";
import { aliasesIn, loaded } from "../../figma/used-tokens.ts";
import { layersUntil } from "../../figma/walk.ts";

type Usage = OperationOutput<"usage">;

/** A token found as the style or variable it names. */
interface Target {
  readonly id: string;
  readonly kind: Usage["kind"];
  readonly name: string;
  readonly variable: boolean;
}

/** The style fields a layer may use a style through, and how the answer names each. */
const STYLE_FIELDS = [
  ["fillStyleId", "fill"],
  ["strokeStyleId", "stroke"],
  ["effectStyleId", "effect"],
  ["textStyleId", "text"],
] as const;

/** The paint fields a variable may be bound inside, and how the answer names each. */
const PAINT_FIELDS = [
  ["fills", "fill"],
  ["strokes", "stroke"],
  ["effects", "effect"],
] as const;

/** The style kinds a token may name, in the order they are looked for; a text style's token ends in -font. */
const STYLE_KINDS: readonly (readonly [StyleKind, Usage["kind"]])[] = [
  ["PAINT", "paint style"],
  ["EFFECT", "effect style"],
  ["TEXT", "text style"],
];

/**
 * The `usage` operation: the layers that use a style or variable, named by its token as design_read writes it, the
 * style found through the same token index design_apply binds with, so --White-2 is the style tokens_read calls so.
 */
export async function usage({ token, within }: OperationInput<"usage">): Promise<Usage> {
  const target = await targetOf(token);
  const root = within === undefined ? figma.currentPage : await requireNode(within);

  await loaded(root);

  const { layers: all, finished } = layersUntil(root, Date.now() + OP_BUDGET_MS);
  const layers: Usage["layers"] = [];
  let more = !finished;

  for (const layer of all) {
    const property = target.variable ? variableUse(layer, target.id) : styleUse(layer, target.id);

    if (property === null) {
      continue;
    }

    // Stops at the first layer past the limit: a text's runs are slow to read, and more says the rest exist.
    if (layers.length === USAGE_MAX_LAYERS) {
      more = true;
      break;
    }

    layers.push({
      id: layer.id,
      name: layer.name,
      type: layer.type,
      property,
    });
  }

  return {
    token,
    kind: target.kind,
    name: target.name,
    layers,
    more,
  };
}

/** The style the token names (paint, then effect, then text), else the variable; none is NODE_NOT_FOUND. */
async function targetOf(token: string): Promise<Target> {
  const index = await TokenIndex.of();

  for (const [kind, label] of STYLE_KINDS) {
    const name = kind === "TEXT" && token.endsWith("-font") ? token.slice(0, -"-font".length) : token;
    const id = await index.style(name, kind);
    const style = id === null ? null : await figma.getStyleByIdAsync(id);

    if (style !== null) {
      return {
        id: style.id,
        kind: label,
        name: style.name,
        variable: false,
      };
    }
  }

  const variable = await index.find(token).catch(() => null);

  if (variable === null) {
    throw new BridgeError(
      "NODE_NOT_FOUND",
      `No style or variable is named ${token} in this file: tokens_read lists them.`,
    );
  }

  return {
    id: variable.id,
    kind: "variable",
    name: variable.name,
    variable: true,
  };
}

/** Where a layer uses the style: a style field, or a text run. */
function styleUse(layer: BaseNode, id: string): string | null {
  const fields = layer as BaseNode & Record<string, unknown>;
  const field = STYLE_FIELDS.find(([key]) => fields[key] === id);

  if (field !== undefined) {
    return field[1];
  }

  if (layer.type === "TEXT" && (layer.fillStyleId === figma.mixed || layer.textStyleId === figma.mixed)) {
    const runs = layer.getStyledTextSegments(["fillStyleId", "textStyleId"]);

    return runs.some((run) => run.fillStyleId === id || run.textStyleId === id) ? "a text run" : null;
  }

  return null;
}

/** Where a layer uses the variable: a bound field, or a paint or effect bound to it. */
function variableUse(layer: BaseNode, id: string): string | null {
  const fields = layer as BaseNode & Record<string, unknown>;
  const bound = Object.entries((fields.boundVariables ?? {}) as Record<string, unknown>).find(([, alias]) =>
    aliasesIn(alias).includes(id),
  );

  if (bound !== undefined) {
    return bound[0];
  }

  return PAINT_FIELDS.find(([key]) => aliasesIn(fields[key]).includes(id))?.[1] ?? null;
}

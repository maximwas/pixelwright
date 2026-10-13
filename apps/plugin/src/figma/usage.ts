import { BridgeError, type OperationInput, type OperationOutput } from "@pixelwright/core";
import { USAGE_MAX_LAYERS } from "../constants/plugin.ts";
import { requireNode } from "./nodes.ts";
import { tokenIndex } from "./token-index.ts";
import { aliasesIn, loaded } from "./used-tokens.ts";

type Usage = OperationOutput<"usage">;

const STYLE_FIELDS = [
  ["fillStyleId", "fill"],
  ["strokeStyleId", "stroke"],
  ["effectStyleId", "effect"],
  ["textStyleId", "text"],
] as const;

/**
 * The layers that use a style or variable, named by its token as design_read writes it: the style through the same
 * token index design_apply binds with, so --White-2 is the style tokens_read calls --White-2.
 */
export async function usage({ token, within }: OperationInput<"usage">): Promise<Usage> {
  const target = await find(token);
  const root = within === undefined ? figma.currentPage : await requireNode(within);

  await loaded(root);

  const layers: Usage["layers"] = [];
  let more = false;
  const all = "findAll" in root ? [root, ...root.findAll(() => true)] : [root];

  for (const layer of all) {
    const property = target.variable ? variableUse(layer, target.id) : styleUse(layer, target.id);

    if (property === null) {
      continue;
    }

    if (layers.length >= USAGE_MAX_LAYERS) {
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

async function find(token: string): Promise<{ id: string; kind: Usage["kind"]; name: string; variable: boolean }> {
  const index = await tokenIndex({ importing: false });
  const base = token.endsWith("-font") ? token.slice(0, -"-font".length) : token;
  const kinds = [
    ["PAINT", token, "paint style"],
    ["EFFECT", token, "effect style"],
    ["TEXT", base, "text style"],
  ] as const;

  for (const [kind, name, label] of kinds) {
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

  const variable = await index.variable(token).catch(() => null);

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

function styleUse(layer: BaseNode, id: string): string | null {
  const record = layer as BaseNode & Record<string, unknown>;

  for (const [field, property] of STYLE_FIELDS) {
    if (record[field] === id) {
      return property;
    }
  }

  if (layer.type === "TEXT" && (layer.fillStyleId === figma.mixed || layer.textStyleId === figma.mixed)) {
    const runs = layer.getStyledTextSegments(["fillStyleId", "textStyleId"]);

    if (runs.some((run) => run.fillStyleId === id || run.textStyleId === id)) {
      return "a text run";
    }
  }

  return null;
}

function variableUse(layer: BaseNode, id: string): string | null {
  const record = layer as BaseNode & Record<string, unknown>;
  const bound = (record.boundVariables ?? {}) as Record<string, unknown>;

  for (const [field, alias] of Object.entries(bound)) {
    if (aliasesIn(alias).includes(id)) {
      return field;
    }
  }

  for (const [field, property] of [
    ["fills", "fill"],
    ["strokes", "stroke"],
    ["effects", "effect"],
  ] as const) {
    if (aliasesIn(record[field]).includes(id)) {
      return property;
    }
  }

  return null;
}

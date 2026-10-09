import {
  type CollectionPlan,
  type OperationInput,
  type OperationOutput,
  type RawTokens,
  type TokenError,
  tokenName,
  type VariablePlan,
  type VariableValueSpec,
  variableTokenName,
} from "@pixelwright/core";
import { errorMessage } from "../utils/error-message.ts";
import { effectsOf, paintsOf } from "./apply-props.ts";
import { requireEdits } from "./edits.ts";
import { fontNameOf } from "./fonts.ts";
import { type TokenIndex, tokenIndex } from "./token-index.ts";
import { variables } from "./variables.ts";
import { WriteError } from "./write-error.ts";

/** A variable an alias may point at: by its CSS name. */
interface Known {
  readonly id: string;
  readonly type: string;
}

/** A planned collection being written: Figma's (none for a new one on a dry run) and its modes' ids by name. */
interface Target {
  readonly plan: CollectionPlan;
  readonly collection: VariableCollection | null;
  readonly modes: Map<string, string>;
  /** Modes that could not be made: their values are not written, the mode's error says why. */
  readonly failed: Set<string>;
}

/** A planned variable and the Figma one it is written to (none for a new one on a dry run). */
interface Written {
  readonly target: Target;
  readonly plan: VariablePlan;
  readonly variable: Variable | null;
  readonly type: string;
  readonly isNew: boolean;
}

type Results = OperationOutput<"tokens_apply">;

/**
 * Variables written by name in the file's own collections: collections and modes made as needed (a new collection's
 * first mode renames Figma's default), variables made or found in their collection, then every value, so an alias
 * finds a variable of the call whatever the order. What already holds the value is left as it is, so tokens_read's own
 * output writes nothing. A library's collection is never copied into the file: a value it does not hold is an error.
 * One undo step; a dry run writes nothing and needs no Allow edits.
 */
export async function tokensApply({ plan, dryRun }: OperationInput<"tokens_apply">): Promise<Results> {
  if (!dryRun) {
    requireEdits();
  }

  const raw = await variables({
    libraries: false,
    used: true,
  });
  const results: Results = {
    created: [],
    updated: [],
    errors: [],
  };
  const known = new Map<string, Known>();

  for (const variable of raw.variables) {
    known.set(variableTokenName(variable), {
      id: variable.id,
      type: variable.resolvedType,
    });
  }

  for (const [id, variable] of Object.entries(raw.external)) {
    known.set(variableTokenName(variable), {
      id,
      type: variable.resolvedType,
    });
  }

  const written: Written[] = [];
  const pending: { target: Target; plan: VariablePlan }[] = [];

  for (const collection of plan.collections) {
    const local = raw.collections.find((item) => item.name === collection.name && !item.remote);
    const library = raw.collections.find((item) => item.name === collection.name && item.remote);

    if (local === undefined && library !== undefined) {
      results.errors.push(...libraryDifferences(collection, library, raw, known));
      continue;
    }

    const target = await targetOf(collection, local, dryRun, results);

    for (const variable of collection.variables) {
      const existing =
        local === undefined
          ? undefined
          : raw.variables.find((item) => item.collectionId === local.id && item.name === variable.name);

      if (existing !== undefined) {
        if (variable.type !== null && variable.type !== existing.resolvedType) {
          results.errors.push(
            fault(
              target,
              variable,
              `${variable.name} is a ${existing.resolvedType} variable: its values cannot be ${variable.type}.`,
            ),
          );
          continue;
        }

        written.push({
          target,
          plan: variable,
          variable: await figma.variables.getVariableByIdAsync(existing.id),
          type: existing.resolvedType,
          isNew: false,
        });
      } else if (variable.type === null) {
        // Only aliases: it takes its target's type, once the targets of the call exist.
        pending.push({
          target,
          plan: variable,
        });
      } else {
        written.push(make(target, variable, variable.type, dryRun, known, results));
      }
    }
  }

  // Alias-only new variables, as their targets come to exist.
  for (let progress = true; progress && pending.length > 0; ) {
    progress = false;

    for (const item of [...pending]) {
      const type = aliasTypeOf(item.plan, known);

      if (type !== null) {
        pending.splice(pending.indexOf(item), 1);
        written.push(make(item.target, item.plan, type, dryRun, known, results));
        progress = true;
      }
    }
  }

  for (const { target, plan: variable } of pending) {
    results.errors.push(fault(target, variable, `${aliasesOf(variable).join(", ")} names no variable of this file.`));
  }

  for (const item of written) {
    await writeValues(item, dryRun, known, results);
  }

  await writeStyles(plan.styles, raw, dryRun, results);

  if (!dryRun && (results.created.length > 0 || results.updated.length > 0)) {
    figma.commitUndo();
  }

  return results;
}

/** The planned collection's Figma collection and modes, made as needed; a mode Figma refuses is that mode's error. */
async function targetOf(
  plan: CollectionPlan,
  local: RawTokens["collections"][number] | undefined,
  dryRun: boolean,
  results: Results,
): Promise<Target> {
  const madeMode = (name: string) =>
    results.created.push({
      kind: "mode",
      collection: plan.name,
      name,
    });

  if (local === undefined) {
    results.created.push({
      kind: "collection",
      name: plan.name,
    });

    const collection = dryRun ? null : figma.variables.createVariableCollection(plan.name);
    const target: Target = {
      plan,
      collection,
      modes: new Map(),
      failed: new Set(),
    };

    plan.modes.forEach((name, index) => {
      try {
        if (collection === null) {
          target.modes.set(name, `dry:${name}`);
        } else if (index === 0) {
          const first = collection.modes[0]?.modeId ?? collection.defaultModeId;

          collection.renameMode(first, name);
          target.modes.set(name, first);
        } else {
          target.modes.set(name, collection.addMode(name));
        }

        madeMode(name);
      } catch (error) {
        target.failed.add(name);
        results.errors.push({
          kind: "mode",
          collection: plan.name,
          name,
          message: errorMessage(error),
        });
      }
    });

    return target;
  }

  const collection = dryRun ? null : await figma.variables.getVariableCollectionByIdAsync(local.id);
  const target: Target = {
    plan,
    collection,
    modes: new Map(local.modes.map(({ name, modeId }) => [name, modeId])),
    failed: new Set(),
  };

  for (const name of plan.modes) {
    if (target.modes.has(name)) {
      continue;
    }

    try {
      target.modes.set(name, collection === null ? `dry:${name}` : collection.addMode(name));
      madeMode(name);
    } catch (error) {
      target.modes.delete(name);
      target.failed.add(name);
      results.errors.push({
        kind: "mode",
        collection: plan.name,
        name,
        message: errorMessage(error),
      });
    }
  }

  return target;
}

/** A new variable in its collection, found by its CSS name from now on. */
function make(
  target: Target,
  plan: VariablePlan,
  type: string,
  dryRun: boolean,
  known: Map<string, Known>,
  results: Results,
): Written {
  const variable =
    target.collection === null
      ? null
      : figma.variables.createVariable(plan.name, target.collection, type as VariableResolvedDataType);

  known.set(plan.token ?? tokenName(plan.name), {
    id: variable?.id ?? `dry:${target.plan.name}/${plan.name}`,
    type,
  });
  results.created.push({
    kind: "variable",
    collection: target.plan.name,
    name: plan.name,
  });

  return {
    target,
    plan,
    variable: dryRun ? null : variable,
    type,
    isNew: true,
  };
}

/** Each mode's value, the description and the code syntax, where they differ from what the variable holds. */
async function writeValues(item: Written, dryRun: boolean, known: Map<string, Known>, results: Results): Promise<void> {
  const { target, plan, variable, type, isNew } = item;
  let changed = false;

  for (const [mode, spec] of Object.entries(plan.values)) {
    const modeId = target.modes.get(mode);

    if (modeId === undefined) {
      if (!target.failed.has(mode)) {
        results.errors.push(
          fault(target, plan, `${target.plan.name} has no mode ${mode}: list it in the collection's modes.`, mode),
        );
      }

      continue;
    }

    const value = figmaValue(spec, type, known);

    if (typeof value === "string") {
      results.errors.push(fault(target, plan, value, mode));
      continue;
    }

    if (!isNew && same(variable?.valuesByMode[modeId], value.value)) {
      continue;
    }

    try {
      if (!dryRun && variable !== null) {
        variable.setValueForMode(
          modeId,
          value.alias === undefined
            ? (value.value as VariableValue)
            : figma.variables.createVariableAlias(
                (await figma.variables.getVariableByIdAsync(value.alias)) as Variable,
              ),
        );
      }

      changed = true;
    } catch (error) {
      results.errors.push(fault(target, plan, errorMessage(error), mode));
    }
  }

  if (plan.description !== undefined && plan.description !== (variable?.description ?? "")) {
    if (!dryRun && variable !== null) {
      variable.description = plan.description;
    }

    changed = true;
  }

  if (plan.token !== undefined && (variable === null || variableTokenName(variable) !== plan.token)) {
    if (!dryRun && variable !== null) {
      variable.setVariableCodeSyntax("WEB", `var(${plan.token})`);
    }

    changed ||= variable !== null;
  }

  if (changed && !isNew) {
    results.updated.push({
      kind: "variable",
      collection: target.plan.name,
      name: plan.name,
    });
  }
}

/**
 * A value as Figma holds it, an alias by its target's id; a string says why it cannot be written (an alias to nothing,
 * or to a variable of another type).
 */
function figmaValue(
  spec: VariableValueSpec,
  type: string,
  known: ReadonlyMap<string, Known>,
): { value: unknown; alias?: string } | string {
  switch (spec.kind) {
    case "alias": {
      const target = known.get(spec.token);

      if (target === undefined) {
        return `var(${spec.token}) names no variable of this file.`;
      }

      if (target.type !== type) {
        return `var(${spec.token}) is a ${target.type} variable, this one is ${type}.`;
      }

      return {
        value: {
          type: "VARIABLE_ALIAS",
          id: target.id,
        },
        alias: target.id,
      };
    }
    case "color":
      return { value: { ...spec.color } };
    default:
      return { value: spec.value };
  }
}

/** Whether Figma already holds the value: colours to the 8 bits CSS writes them in, numbers to a millionth. */
function same(current: unknown, next: unknown): boolean {
  if (isAlias(current) || isAlias(next)) {
    return isAlias(current) && isAlias(next) && current.id === next.id;
  }

  if (isColor(current) && isColor(next)) {
    const channel = (value: number) => Math.round(value * 255);

    return (
      channel(current.r) === channel(next.r) &&
      channel(current.g) === channel(next.g) &&
      channel(current.b) === channel(next.b) &&
      Math.abs((current.a ?? 1) - (next.a ?? 1)) < 0.005
    );
  }

  if (typeof current === "number" && typeof next === "number") {
    return Math.abs(current - next) < 1e-6;
  }

  return current === next;
}

function isAlias(value: unknown): value is { type: "VARIABLE_ALIAS"; id: string } {
  return typeof value === "object" && value !== null && (value as { type?: unknown }).type === "VARIABLE_ALIAS";
}

function isColor(value: unknown): value is { r: number; g: number; b: number; a?: number } {
  return typeof value === "object" && value !== null && typeof (value as { r?: unknown }).r === "number";
}

/** A library's collection the call names: each planned value it does not hold is an error, never a local copy. */
function libraryDifferences(
  plan: CollectionPlan,
  library: RawTokens["collections"][number],
  raw: RawTokens,
  known: ReadonlyMap<string, Known>,
): TokenError[] {
  const modes = new Map(library.modes.map(({ name, modeId }) => [name, modeId]));

  return plan.variables.flatMap((variable) => {
    const held = raw.variables.find((item) => item.collectionId === library.id && item.name === variable.name);
    const differs =
      held === undefined ||
      Object.entries(variable.values).some(([mode, spec]) => {
        const modeId = modes.get(mode);
        const value = figmaValue(spec, held.resolvedType, known);

        return modeId === undefined || typeof value === "string" || !same(held.valuesByMode[modeId], value.value);
      });

    return differs
      ? [
          {
            kind: "variable" as const,
            collection: plan.name,
            name: variable.name,
            message: `${plan.name} comes from a library: change ${variable.name} there.`,
          },
        ]
      : [];
  });
}

/** The type of the first alias target that exists. */
function aliasTypeOf(plan: VariablePlan, known: ReadonlyMap<string, Known>): string | null {
  for (const value of Object.values(plan.values)) {
    const target = value.kind === "alias" ? known.get(value.token) : undefined;

    if (target !== undefined) {
      return target.type;
    }
  }

  return null;
}

/** The aliases a variable's values are, as the XML writes them. */
function aliasesOf(plan: VariablePlan): string[] {
  return Object.values(plan.values).flatMap((value) => (value.kind === "alias" ? [`var(${value.token})`] : []));
}

function fault(target: Target, plan: VariablePlan, message: string, mode?: string): TokenError {
  return {
    kind: "variable",
    collection: target.plan.name,
    name: plan.name,
    ...(mode === undefined ? {} : { mode }),
    message,
  };
}

/** What a style holds, as tokens_apply compares and writes it. */
type StyleValue =
  | { readonly kind: "paint"; readonly paints: Paint[] }
  | {
      readonly kind: "text";
      readonly fontName: FontName;
      readonly fontSize: number;
      readonly lineHeight: LineHeight;
    }
  | { readonly kind: "effect"; readonly effects: Effect[] };

/**
 * Paint, text and effect styles by name among the file's own: made when it has none, changed where they differ. A
 * library's style of that name the page uses is left alone (a value it does not hold is an error), never copied.
 */
async function writeStyles(
  plan: OperationInput<"tokens_apply">["plan"]["styles"],
  raw: RawTokens,
  dryRun: boolean,
  results: Results,
): Promise<void> {
  let index: Promise<TokenIndex> | null = null;
  const context = {
    tokens: () => {
      index ??= tokenIndex();

      return index;
    },
  };
  const wanted: { kind: "paint" | "text" | "effect"; name: string; value: () => Promise<StyleValue> }[] = [
    ...plan.paint.map(({ name, paints }) => ({
      kind: "paint" as const,
      name,
      value: async (): Promise<StyleValue> => {
        const resolved = await paintsOf(paints, context);

        if ("style" in resolved) {
          throw new WriteError("A paint style holds paints: it cannot point at another paint style.");
        }

        return {
          kind: "paint",
          paints: resolved.paints,
        };
      },
    })),
    ...plan.text.map(({ name, font }) => ({
      kind: "text" as const,
      name,
      value: async (): Promise<StyleValue> => {
        const fontName = await fontNameOf(font);

        if (!dryRun) {
          await figma.loadFontAsync(fontName);
        }

        return {
          kind: "text",
          fontName,
          fontSize: font.size,
          lineHeight: font.lineHeight as LineHeight,
        };
      },
    })),
    ...plan.effect.map(({ name, effects }) => ({
      kind: "effect" as const,
      name,
      value: async (): Promise<StyleValue> => ({
        kind: "effect",
        effects: effectsOf(effects),
      }),
    })),
  ];
  const locals: Record<"paint" | "text" | "effect", BaseStyle[]> = {
    paint: await figma.getLocalPaintStylesAsync(),
    text: await figma.getLocalTextStylesAsync(),
    effect: await figma.getLocalEffectStylesAsync(),
  };

  for (const { kind, name, value } of wanted) {
    try {
      const next = await value();
      const style = locals[kind].find((item) => item.name === name) ?? null;
      const library = raw.styles.find((item) => item.remote && item.name === name && item.type === kind.toUpperCase());

      if (style === null && library !== undefined) {
        if (!holds(library as unknown as BaseStyle, next)) {
          results.errors.push({
            kind,
            name,
            message: `${name} comes from a library: change it there.`,
          });
        }

        continue;
      }

      if (style !== null && holds(style, next)) {
        continue;
      }

      if (!dryRun) {
        write(style ?? made(kind, name), next);
      }

      (style === null ? results.created : results.updated).push({
        kind,
        name,
      });
    } catch (error) {
      results.errors.push({
        kind,
        name,
        message: errorMessage(error),
      });
    }
  }
}

function made(kind: "paint" | "text" | "effect", name: string): BaseStyle {
  const style =
    kind === "paint" ? figma.createPaintStyle() : kind === "text" ? figma.createTextStyle() : figma.createEffectStyle();

  style.name = name;

  return style;
}

function write(style: BaseStyle, value: StyleValue): void {
  if (value.kind === "paint") {
    (style as PaintStyle).paints = value.paints;
  } else if (value.kind === "text") {
    const text = style as TextStyle;

    text.fontName = value.fontName;
    text.fontSize = value.fontSize;
    text.lineHeight = value.lineHeight;
  } else {
    (style as EffectStyle).effects = value.effects;
  }
}

/**
 * Whether a style holds the value already, judged as CSS writes it (the values came through tokens_read's CSS): colours
 * to 8 bits per channel, opacities to 0.005, a font by name and size.
 */
function holds(style: BaseStyle, value: StyleValue): boolean {
  if (value.kind === "paint") {
    return JSON.stringify(paintKeys((style as PaintStyle).paints ?? [])) === JSON.stringify(paintKeys(value.paints));
  }

  if (value.kind === "text") {
    const text = style as TextStyle;

    return (
      text.fontName?.family === value.fontName.family &&
      text.fontName.style === value.fontName.style &&
      text.fontSize === value.fontSize &&
      JSON.stringify(text.lineHeight) === JSON.stringify(value.lineHeight)
    );
  }

  return JSON.stringify(effectKeys((style as EffectStyle).effects ?? [])) === JSON.stringify(effectKeys(value.effects));
}

/** The parts of paints that make them look as they do, rounded as CSS writes them. */
function paintKeys(paints: readonly Paint[]): unknown[] {
  return paints
    .filter((paint) => paint.visible ?? true)
    .map((paint) => {
      const solid = paint as Partial<SolidPaint>;

      return [
        paint.type,
        Math.round((paint.opacity ?? 1) * 200),
        solid.color === undefined
          ? null
          : [solid.color.r, solid.color.g, solid.color.b].map((channel) => Math.round(channel * 255)),
        solid.boundVariables?.color?.id ?? null,
      ];
    });
}

/** The parts of effects that make them look as they do, rounded as CSS writes them. */
function effectKeys(effects: readonly Effect[]): unknown[] {
  const round = (value: number | undefined) => Math.round((value ?? 0) * 1_000);

  return effects
    .filter((effect) => effect.visible ?? true)
    .map((effect) => {
      const shadow = effect as Partial<DropShadowEffect>;

      return [
        effect.type,
        round((effect as { radius?: number }).radius),
        round(shadow.spread),
        round(shadow.offset?.x),
        round(shadow.offset?.y),
        shadow.color === undefined
          ? null
          : [shadow.color.r, shadow.color.g, shadow.color.b, shadow.color.a].map((channel) =>
              Math.round(channel * 255),
            ),
      ];
    });
}

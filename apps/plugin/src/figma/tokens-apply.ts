import {
  type CollectionPlan,
  lineHeightCss,
  type OperationInput,
  type OperationOutput,
  px,
  type RawTokens,
  styleValueOf,
  type TokenError,
  type TokenModel,
  tokenModel,
  tokenName,
  type VariablePlan,
  type VariableValueSpec,
  variableTokenName,
  variableValueOf,
  weightOf,
} from "@pixelwright/core";
import { errorMessage } from "../utils/error-message.ts";
import { effectKey, effectsOf, mergedEffects, paintsOf } from "./apply-props.ts";
import { documentColor } from "./color-profile.ts";
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
  /** The variable as the file holds it, for one that exists. */
  readonly held: RawTokens["variables"][number] | null;
  readonly type: string;
  readonly isNew: boolean;
}

type Results = OperationOutput<"tokens_apply">;

/** The call's results, and whether it wrote anything: one undo step covers it even when nothing new came of it. */
interface State {
  readonly results: Results;
  readonly dryRun: boolean;
  readonly index: () => Promise<TokenIndex>;
  wrote: boolean;
}

/** Effects an effect style's CSS shows: its shadows (tokens_read leaves blurs out). */
const STYLE_EFFECTS: ReadonlySet<string> = new Set(["DROP_SHADOW", "INNER_SHADOW"]);

/**
 * Variables and styles written by name among the file's own: collections and modes made as needed (a new collection's
 * first mode renames Figma's default), variables made or found in their collection, then every value, so an alias
 * finds a variable of the call whatever the order. What the file holds already is judged as tokens_read writes it, in
 * CSS, so its own output writes nothing; a value that does change keeps what CSS cannot show (a style's own face, a
 * line height that renders the same, an effect style's blurs, an opacity kept as a percent). A library's collection or
 * style is never copied into the file. Each item Figma refuses is its own error; one undo step for the call; a dry
 * run writes nothing and needs no Allow edits.
 */
export async function tokensApply({ plan, dryRun }: OperationInput<"tokens_apply">): Promise<Results> {
  if (!dryRun) {
    requireEdits();
  }

  const { tokens: raw, libraryCollections } = await tokensOfFile(plan);
  const model = tokenModel(raw);
  let index: Promise<TokenIndex> | null = null;
  const state: State = {
    results: {
      created: [],
      updated: [],
      errors: [],
    },
    dryRun,
    index: () => {
      index ??= tokenIndex({ importing: !dryRun });

      return index;
    },
    wrote: false,
  };
  const known = knownTokens(raw);

  await resolveAliases(plan, known, state);

  const written: Written[] = [];
  const pending: { target: Target; plan: VariablePlan }[] = [];

  for (const collection of plan.collections) {
    const local = raw.collections.find((item) => item.name === collection.name && !item.remote);
    const library = raw.collections.find((item) => item.name === collection.name && item.remote);

    if (local === undefined && (library !== undefined || libraryCollections.has(collection.name))) {
      state.results.errors.push(...libraryDifferences(collection, model));
      continue;
    }

    const target = await targetOf(collection, local, state);

    if (target === null) {
      continue;
    }

    for (const variable of collection.variables) {
      const held =
        local === undefined
          ? undefined
          : raw.variables.find((item) => item.collectionId === local.id && item.name === variable.name);

      if (held !== undefined) {
        if (variable.type !== null && variable.type !== held.resolvedType) {
          state.results.errors.push(
            fault(
              target,
              variable,
              `${variable.name} is a ${held.resolvedType} variable: its values cannot be ${variable.type}.`,
            ),
          );
          continue;
        }

        written.push({
          target,
          plan: variable,
          variable: await figma.variables.getVariableByIdAsync(held.id),
          held,
          type: held.resolvedType,
          isNew: false,
        });
      } else if (variable.type === null) {
        // Only aliases: it takes its target's type, once the targets of the call exist.
        pending.push({
          target,
          plan: variable,
        });
      } else {
        const made = make(target, variable, variable.type, known, state);

        if (made !== null) {
          written.push(made);
        }
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

        const made = make(item.target, item.plan, type, known, state);

        if (made !== null) {
          written.push(made);
        }

        progress = true;
      }
    }
  }

  for (const { target, plan: variable } of pending) {
    state.results.errors.push(
      fault(target, variable, `${aliasesOf(variable).join(", ")} names no variable of this file.`),
    );
  }

  for (const item of written) {
    await writeValues(item, model, known, state);
  }

  await writeStyles(plan.styles, raw, model, state);

  if (!dryRun && state.wrote) {
    figma.commitUndo();
  }

  return state.results;
}

/**
 * The file's tokens as tokens_read sees them; when the call names a collection or style the current page does not
 * show, also those the other pages use (a library's may be used only there) and the enabled libraries' collection
 * names, so a library's token is never taken for a new one.
 */
async function tokensOfFile(
  plan: OperationInput<"tokens_apply">["plan"],
): Promise<{ tokens: RawTokens; libraryCollections: ReadonlySet<string> }> {
  const tokens = await variables({
    libraries: false,
    used: true,
  });
  const knows = () =>
    plan.collections.every((collection) => tokens.collections.some((item) => item.name === collection.name)) &&
    (["paint", "text", "effect"] as const).every((kind) =>
      plan.styles[kind].every((style) =>
        tokens.styles.some((item) => item.name === style.name && item.type === kind.toUpperCase()),
      ),
    );
  const libraryCollections = new Set<string>();

  if (knows()) {
    return {
      tokens,
      libraryCollections,
    };
  }

  await figma.loadAllPagesAsync();

  for (const page of figma.root.children) {
    if (page.id !== figma.currentPage.id) {
      merge(
        tokens,
        await variables({
          libraries: false,
          used: true,
          within: page.id,
        }),
      );
    }
  }

  try {
    for (const collection of await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()) {
      libraryCollections.add(collection.name);
    }
  } catch {
    // Libraries that cannot be read leave only the file's own names.
  }

  return {
    tokens,
    libraryCollections,
  };
}

function merge(into: RawTokens, more: RawTokens): void {
  const has = (list: readonly { id: string }[], id: string) => list.some((item) => item.id === id);

  into.collections.push(...more.collections.filter((item) => !has(into.collections, item.id)));
  into.variables.push(...more.variables.filter((item) => !has(into.variables, item.id)));
  into.styles.push(...more.styles.filter((item) => !has(into.styles, item.id)));
  Object.assign(into.external, more.external);
}

/** The file's variables by their CSS names. */
function knownTokens(raw: RawTokens): Map<string, Known> {
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

  return known;
}

/**
 * Aliases to variables neither the file nor the call has: an enabled library's, found by name and imported on a real
 * run. One that is nowhere stays unknown, which is that value's error.
 */
async function resolveAliases(
  plan: OperationInput<"tokens_apply">["plan"],
  known: Map<string, Known>,
  state: State,
): Promise<void> {
  const own = new Set(
    plan.collections.flatMap((collection) =>
      collection.variables.map((variable) => variable.token ?? tokenName(variable.name)),
    ),
  );

  for (const collection of plan.collections) {
    for (const variable of collection.variables) {
      for (const value of Object.values(variable.values)) {
        if (value.kind !== "alias" || known.has(value.token) || own.has(value.token)) {
          continue;
        }

        try {
          const found = await (await state.index()).variable(value.token);

          known.set(value.token, {
            id: found.id,
            type: found.resolvedType,
          });
        } catch {
          // Unknown everywhere: the value's own error says so.
        }
      }
    }
  }
}

/** The planned collection's Figma collection and modes, made as needed; what Figma refuses is that item's error. */
async function targetOf(
  plan: CollectionPlan,
  local: RawTokens["collections"][number] | undefined,
  state: State,
): Promise<Target | null> {
  const { results, dryRun } = state;
  const refused = (name: string, error: unknown) => {
    results.errors.push({
      kind: "mode",
      collection: plan.name,
      name,
      message: errorMessage(error),
    });
  };

  if (local === undefined) {
    let collection: VariableCollection | null = null;

    try {
      collection = dryRun ? null : figma.variables.createVariableCollection(plan.name);
    } catch (error) {
      results.errors.push({
        kind: "collection",
        name: plan.name,
        message: errorMessage(error),
      });

      return null;
    }

    state.wrote ||= collection !== null;
    results.created.push({
      kind: "collection",
      name: plan.name,
    });

    const target: Target = {
      plan,
      collection,
      modes: new Map(),
      failed: new Set(),
    };

    plan.modes.forEach((name, position) => {
      try {
        if (collection === null) {
          target.modes.set(name, `dry:${name}`);
        } else if (position === 0) {
          const first = collection.modes[0]?.modeId ?? collection.defaultModeId;

          collection.renameMode(first, name);
          target.modes.set(name, first);
        } else {
          target.modes.set(name, collection.addMode(name));
        }

        results.created.push({
          kind: "mode",
          collection: plan.name,
          name,
        });
      } catch (error) {
        target.failed.add(name);
        refused(name, error);
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
      state.wrote ||= collection !== null;
      results.created.push({
        kind: "mode",
        collection: plan.name,
        name,
      });
    } catch (error) {
      target.failed.add(name);
      refused(name, error);
    }
  }

  return target;
}

/** A new variable in its collection, found by its CSS name from now on; null when Figma refuses it (its error). */
function make(
  target: Target,
  plan: VariablePlan,
  type: string,
  known: Map<string, Known>,
  state: State,
): Written | null {
  let variable: Variable | null = null;

  try {
    variable =
      target.collection === null
        ? null
        : figma.variables.createVariable(plan.name, target.collection, type as VariableResolvedDataType);
  } catch (error) {
    state.results.errors.push(fault(target, plan, errorMessage(error)));

    return null;
  }

  state.wrote ||= variable !== null;
  known.set(plan.token ?? tokenName(plan.name), {
    id: variable?.id ?? `dry:${target.plan.name}/${plan.name}`,
    type,
  });
  state.results.created.push({
    kind: "variable",
    collection: target.plan.name,
    name: plan.name,
  });

  return {
    target,
    plan,
    variable,
    held: null,
    type,
    isNew: true,
  };
}

/** Each mode's value, the description and the code syntax, where tokens_read's CSS of them differs from the call's. */
async function writeValues(item: Written, model: TokenModel, known: Map<string, Known>, state: State): Promise<void> {
  const { target, plan, variable, held, type, isNew } = item;
  const shown = isNew ? undefined : shownVariable(model, target.plan.name, plan.name);
  let changed = false;
  const attempt = (write: () => void, mode?: string) => {
    try {
      if (!state.dryRun && variable !== null) {
        write();
        state.wrote = true;
      }

      changed = true;
    } catch (error) {
      state.results.errors.push(fault(target, plan, errorMessage(error), mode));
    }
  };

  for (const [mode, spec] of Object.entries(plan.values)) {
    const modeId = target.modes.get(mode);

    if (modeId === undefined) {
      if (!target.failed.has(mode)) {
        state.results.errors.push(
          fault(target, plan, `${target.plan.name} has no mode ${mode}: list it in the collection's modes.`, mode),
        );
      }

      continue;
    }

    const css = shown?.values[mode];

    if (css !== undefined && sameSpec(variableValueOf(css, type as never), spec)) {
      continue;
    }

    const value = figmaValue(spec, type, known);

    if (typeof value === "string") {
      state.results.errors.push(fault(target, plan, value, mode));
      continue;
    }

    // An opacity Figma keeps as a percent (tokens_read shows it divided by 100) is written back as one.
    const stored = typeof value.value === "number" && percentStored(held) ? value.value * 100 : value.value;

    attempt(() => {
      variable?.setValueForMode(
        modeId,
        value.alias === undefined
          ? (stored as VariableValue)
          : figma.variables.createVariableAlias({ id: value.alias } as Variable),
      );
    }, mode);
  }

  if (plan.description !== undefined && plan.description !== (shown?.description ?? "")) {
    attempt(() => {
      if (variable !== null) {
        variable.description = plan.description ?? "";
      }
    });
  }

  if (plan.token !== undefined && plan.token !== (shown?.token ?? tokenName(plan.name))) {
    attempt(() => variable?.setVariableCodeSyntax("WEB", `var(${plan.token})`));
  }

  if (changed && !isNew) {
    state.results.updated.push({
      kind: "variable",
      collection: target.plan.name,
      name: plan.name,
    });
  }
}

/** A variable as tokens_read shows it, by collection and name. */
function shownVariable(model: TokenModel, collection: string, name: string) {
  return model.collections.find((item) => item.name === collection)?.variables.find((item) => item.name === name);
}

/** Whether two values read from CSS are the same. */
function sameSpec(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** A variable whose opacity scope Figma fills with percents: tokens_read shows its values divided by 100. */
function percentStored(held: RawTokens["variables"][number] | null): boolean {
  if (held === null) {
    return false;
  }

  return (
    held.scopes.some((scope) => scope === "OPACITY" || scope === "COLOR_OPACITY") &&
    Object.values(held.valuesByMode).some((value) => typeof value === "number" && value > 1)
  );
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
        return `var(${spec.token}) names no variable of this file or its libraries.`;
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
      return { value: documentColor(spec.color) };
    default:
      return { value: spec.value };
  }
}

/** A library's collection the call names: each planned value tokens_read shows differently is an error, never a copy. */
function libraryDifferences(plan: CollectionPlan, model: TokenModel): TokenError[] {
  return plan.variables.flatMap((variable) => {
    const shown = shownVariable(model, plan.name, variable.name);
    const differs =
      shown === undefined ||
      Object.entries(variable.values).some(([mode, spec]) => {
        const css = shown.values[mode];

        return css === undefined || !sameSpec(variableValueOf(css, shown.type as never), spec);
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

/** What a style holds, as tokens_apply writes it. */
type StyleValue =
  | { readonly kind: "paint"; readonly paints: Paint[] }
  | {
      readonly kind: "text";
      readonly fontName: FontName;
      readonly fontSize: number;
      readonly lineHeight: LineHeight;
    }
  | { readonly kind: "effect"; readonly effects: Effect[] };

type StyleKind = "paint" | "text" | "effect";

/**
 * Paint, text and effect styles by name among the file's own: one whose CSS tokens_read shows the same is left alone;
 * one that differs is changed keeping what CSS cannot show (its own face, a size or line height that renders the
 * same, its blurs); one the file lacks is made. A library's style of that name is never copied.
 */
async function writeStyles(
  plan: OperationInput<"tokens_apply">["plan"]["styles"],
  raw: RawTokens,
  model: TokenModel,
  state: State,
): Promise<void> {
  const context = { tokens: state.index };
  const locals: Record<StyleKind, BaseStyle[]> = {
    paint: await figma.getLocalPaintStylesAsync(),
    text: await figma.getLocalTextStylesAsync(),
    effect: await figma.getLocalEffectStylesAsync(),
  };
  const wanted: { kind: StyleKind; name: string; spec: unknown }[] = [
    ...plan.paint.map(({ name, paints }) => ({
      kind: "paint" as const,
      name,
      spec: { paints },
    })),
    ...plan.text.map(({ name, font }) => ({
      kind: "text" as const,
      name,
      spec: { font },
    })),
    ...plan.effect.map(({ name, effects }) => ({
      kind: "effect" as const,
      name,
      spec: { effects },
    })),
  ];

  for (const { kind, name, spec } of wanted) {
    try {
      const shown = model.styles[kind].find((item) => item.name === name);

      if (shown !== undefined && sameSpec(styleValueOf(kind, shown.value), spec)) {
        continue;
      }

      const style = locals[kind].find((item) => item.name === name) ?? null;
      const library = raw.styles.find((item) => item.remote && item.name === name && item.type === kind.toUpperCase());

      if (style === null && library !== undefined) {
        state.results.errors.push({
          kind,
          name,
          message: `${name} comes from a library: change it there.`,
        });
        continue;
      }

      const next = await nextValue(kind, spec, style, context, state.dryRun);

      if (style !== null && holds(style, next)) {
        continue;
      }

      if (!state.dryRun) {
        write(style ?? made(kind, name), next);
        state.wrote = true;
      }

      (style === null ? state.results.created : state.results.updated).push({
        kind,
        name,
      });
    } catch (error) {
      state.results.errors.push({
        kind,
        name,
        message: errorMessage(error),
      });
    }
  }
}

/** The style's new value, keeping what CSS cannot show from the style it changes. */
async function nextValue(
  kind: StyleKind,
  spec: unknown,
  style: BaseStyle | null,
  context: { tokens: () => Promise<TokenIndex> },
  dryRun: boolean,
): Promise<StyleValue> {
  if (kind === "paint") {
    const resolved = await paintsOf((spec as { paints: Parameters<typeof paintsOf>[0] }).paints, context);

    if ("style" in resolved) {
      throw new WriteError("A paint style holds paints: it cannot point at another paint style.");
    }

    return {
      kind,
      paints: resolved.paints,
    };
  }

  if (kind === "text") {
    const { font } = spec as { font: Parameters<typeof fontNameOf>[0] };
    const held = style as TextStyle | null;
    // Its own face first: a condensed or variable face reads as its family and weight only.
    const fontName = await fontNameOf(
      font,
      held === null
        ? []
        : [
            {
              fontName: held.fontName,
              weight: weightOf(held.fontName.style),
            },
          ],
    );
    const fontSize = held !== null && px(held.fontSize) === px(font.size) ? held.fontSize : font.size;
    const lineHeight =
      held !== null &&
      lineHeightCss(held.lineHeight, fontSize) === lineHeightCss(font.lineHeight as LineHeight, fontSize)
        ? held.lineHeight
        : (font.lineHeight as LineHeight);

    if (!dryRun) {
      await figma.loadFontAsync(fontName);
    }

    return {
      kind,
      fontName,
      fontSize,
      lineHeight,
    };
  }

  return {
    kind: "effect",
    effects: mergedEffects(
      (style as EffectStyle | null)?.effects ?? [],
      effectsOf((spec as { effects: Parameters<typeof effectsOf>[0] }).effects),
      STYLE_EFFECTS,
    ),
  };
}

function made(kind: StyleKind, name: string): BaseStyle {
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

/** Whether a style holds the value already, exactly: nothing to write. */
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

  return (
    JSON.stringify(((style as EffectStyle).effects ?? []).map(effectKey)) ===
    JSON.stringify(value.effects.map(effectKey))
  );
}

/** The parts of paints that make them look as they do. */
function paintKeys(paints: readonly Paint[]): unknown[] {
  return paints.map((paint) => {
    const solid = paint as Partial<SolidPaint>;

    return [
      paint.type,
      paint.visible ?? true,
      paint.opacity ?? 1,
      solid.color === undefined ? null : [solid.color.r, solid.color.g, solid.color.b],
      solid.boundVariables?.color?.id ?? null,
    ];
  });
}

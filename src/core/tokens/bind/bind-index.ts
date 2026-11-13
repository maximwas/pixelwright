import { BLURS } from "@/core/css/groups/effects/effects.constants.ts";
import { FIGMA_PAINT, PAINTS_VALUE } from "@/core/css/paints/paints.constants.ts";
import { COLOR_SPACE } from "@/core/kernel/color/color.constants.ts";
import type { Channels, ColorSpace } from "@/core/kernel/color/color.ts";
import type { TokenNames } from "@/core/kernel/names/token-names.ts";
import { BIND_NUMBER, BIND_TEXT, BIND_VALUE, SHADOW_TYPES, STYLE_TYPE } from "@/core/tokens/bind/bind.constants.ts";
import type { BindCandidate, BindRemap, BindScope, ModeMap } from "@/core/tokens/bind/bind.types.ts";
import type { BindFields } from "@/core/tokens/bind/bind-fields.ts";
import type { BindValues } from "@/core/tokens/bind/bind-values.ts";
import { MODEL_TEXT, MODEL_VALUE, VARIABLE_TYPE } from "@/core/tokens/model/model.constants.ts";
import { BIND_SOURCE } from "@/shared/ops/bind/bind.constants.ts";
import type { RawStyle, RawTokens, RawVariable } from "@/shared/ops/variables/variables.schema.ts";
import type { ModelTables } from "@/shared/read-model/read-model.schema.ts";

/** Where a colour or number is: its field's scope and the layer's modes; for a colour, whether a paint style fits. */
interface Lookup {
  readonly scope: BindScope;
  readonly modes: ModeMap;
  readonly stylable?: boolean;
}

/**
 * The file's tokens by the values they hold, for one bind call (K-026): colour and number variables in each layer's
 * modes (aliases followed), paint styles of one visible solid paint, text and effect styles by the value design_read
 * writes; every style and variable by its token as tokens_read writes it, a library's variable by name only.
 */
export class BindIndex {
  /** The file's colour space: a Display P3 file's colours are P3 values. */
  readonly space: ColorSpace;
  /** What design_read's effect CSS reads besides the effects: the file's profile. */
  readonly tables: ModelTables;
  /** The read of the tokens the layers use stopped short: a library token used only past that point is missing. */
  readonly usedCut: boolean;
  readonly #raw: RawTokens;
  readonly #values: BindValues;
  readonly #fields: BindFields;
  readonly #names: TokenNames;
  readonly #variables: Map<string, RawVariable>;
  readonly #defaults: Map<string, string>;
  readonly #own = new Map<string, BindCandidate>();
  readonly #byToken = new Map<string, BindCandidate[]>();
  readonly #styles = new Map<string, Map<string, BindCandidate[]>>();
  readonly #byModes = new Map<string, Map<string, BindCandidate[]>>();

  constructor(
    raw: RawTokens,
    values: BindValues,
    fields: BindFields,
    names: TokenNames,
  ) {
    this.#raw = raw;
    this.#values = values;
    this.#fields = fields;
    this.#names = names;
    this.space = raw.colorProfile === FIGMA_PAINT.displayP3 ? COLOR_SPACE.displayP3 : COLOR_SPACE.srgb;
    this.tables = {
      ...(raw.colorProfile === undefined ? {} : { colorProfile: raw.colorProfile }),
      styles: {},
      variables: {},
    };
    this.usedCut = raw.usedCut ?? false;
    this.#variables = new Map(raw.variables.map((variable) => [variable.id, variable]));
    this.#defaults = new Map(raw.collections.map(({ id, defaultModeId }) => [id, defaultModeId]));
    this.#indexVariables();
    this.#indexStyles();
  }

  /**
   * The tokens holding a colour for a field of this scope in the layer's modes: colour variables, then paint styles of
   * one solid paint when a style may take the paint's place. A variable an alias among them points at is left out (the
   * alias is the token meant), and so is a style wrapping a variable among them.
   */
  colors(value: string, { scope, modes, stylable = false }: Lookup): BindCandidate[] {
    const variables = this.#allowed(this.#valuesIn(modes).get(BIND_TEXT.key(VARIABLE_TYPE.color, value)) ?? [], scope);
    const held = new Set(variables.map(({ id }) => id));
    const styles = stylable
      ? (this.#styles.get(STYLE_TYPE.paint)?.get(value) ?? []).filter(
        ({ wraps }) => wraps === undefined || !held.has(wraps),
      )
      : [];

    return [...this.#withoutTargets(variables, modes), ...styles];
  }

  /** The number variables holding a field's value as a variable bound there holds it (an opacity in percent). */
  numbers(value: number, { scope, modes }: Lookup): BindCandidate[] {
    const amount = this.#values.round(this.#fields.amount(scope, value));
    const variables = this.#allowed(this.#valuesIn(modes).get(BIND_TEXT.key(VARIABLE_TYPE.float, amount)) ?? [], scope);

    return this.#withoutTargets(variables, modes);
  }

  texts(value: string): BindCandidate[] {
    return this.#styles.get(STYLE_TYPE.text)?.get(value) ?? [];
  }

  effects(value: string): BindCandidate[] {
    return this.#styles.get(STYLE_TYPE.effect)?.get(value) ?? [];
  }

  /** The styles and variables a token names (a text style also by its own name, as the XML writes it). */
  byToken(token: string): BindCandidate[] {
    return this.#byToken.get(token.trim()) ?? [];
  }

  /** Whether the file's tokens hold the variable with its values: the index then matches it by its own rules. */
  holds(id: string): boolean {
    return this.#own.has(id);
  }

  /** The styles and variables the remaps' from tokens name: the scan counts each layer's uses of them. */
  sources(remap: readonly BindRemap[]): string[] {
    return [...new Set(remap.flatMap(({ from }) => this.byToken(from).map(({ id }) => id)))];
  }

  #indexVariables(): void {
    for (const variable of this.#raw.variables) {
      const candidate = this.#variable(variable.id, variable);

      this.#own.set(variable.id, candidate);
      this.#name(candidate.token, candidate);
    }

    for (const [id, variable] of Object.entries(this.#raw.external)) {
      const candidate = this.#variable(id, variable);

      this.#name(candidate.token, candidate);
    }
  }

  #variable(id: string, variable: RawVariable | RawTokens["external"][string]): BindCandidate {
    return { token: this.#names.variable(variable), id, source: BIND_SOURCE.variable, type: variable.resolvedType };
  }

  #indexStyles(): void {
    for (const style of this.#raw.styles) {
      const candidate = this.#style(style);
      const value = this.#styleValue(style);

      this.#name(candidate.token, candidate);

      if (style.type === STYLE_TYPE.text) {
        this.#name(this.#names.styleName(style), candidate);
      }

      if (value !== null) {
        const byValue = this.#styles.get(style.type) ?? new Map<string, BindCandidate[]>();

        byValue.set(value, [...(byValue.get(value) ?? []), candidate]);
        this.#styles.set(style.type, byValue);
      }
    }
  }

  /** A style named as tokens_read names it: a text style's font token, a blur-only effect style's filter token. */
  #style(style: RawStyle): BindCandidate {
    const token = this.#names.style(style);
    const wraps =
      style.type === STYLE_TYPE.paint
        ? this.#names.alias(style.paints?.[0]?.boundVariables, PAINTS_VALUE.boundColor)
        : undefined;
    const named =
      style.type === STYLE_TYPE.text ? MODEL_TEXT.part(token, MODEL_VALUE.font) : this.#effectToken(style, token);

    return {
      token: named,
      id: style.id,
      source: BIND_SOURCE.style,
      type: style.type,
      ...(wraps === undefined ? {} : { wraps }),
    };
  }

  /** An effect style's token: its own with shadows, its first blur's (`--Name-filter`) without (D-26). */
  #effectToken(style: RawStyle, token: string): string {
    const visible = (style.effects ?? []).filter((effect) => effect.visible ?? true);
    const blur = visible.find((effect) => BLURS[effect.type] !== undefined);
    const property = blur === undefined ? undefined : BLURS[blur.type]?.property;

    return visible.some((effect) => SHADOW_TYPES.includes(effect.type)) || property === undefined
      ? token
      : MODEL_TEXT.part(token, property);
  }

  /** A style's value as design_read writes a layer that matches it; null when no raw value can equal it. */
  #styleValue(style: RawStyle): string | null {
    if (style.type === STYLE_TYPE.paint) {
      const visible = (style.paints ?? []).filter((paint) => paint.visible ?? true);
      const [paint] = visible;

      return visible.length === 1 && paint?.type === FIGMA_PAINT.solid && paint.color !== undefined
        ? this.#values.color(paint.color, paint.opacity ?? 1, this.space)
        : null;
    }

    if (style.type === STYLE_TYPE.effect) {
      return this.#values.effects(style.effects ?? [], this.tables);
    }

    return style.type === STYLE_TYPE.text ? this.#textOf(style) : null;
  }

  /** A text style's value, when it has the parts a text's are compared on. */
  #textOf({ fontName, fontSize, lineHeight, letterSpacing, textCase, textDecoration }: RawStyle): string | null {
    if (fontName === undefined || fontSize === undefined || lineHeight === undefined) {
      return null;
    }

    return this.#values.text({
      fontName,
      fontSize,
      lineHeight,
      letterSpacing: letterSpacing ?? { unit: BIND_VALUE.pixels, value: 0 },
      textCase: textCase ?? BIND_VALUE.originalCase,
      textDecoration: textDecoration ?? BIND_VALUE.noDecoration,
    });
  }

  #name(token: string, candidate: BindCandidate): void {
    const named = this.#byToken.get(token) ?? [];

    if (!named.some(({ id }) => id === candidate.id)) {
      this.#byToken.set(token, [...named, candidate]);
    }
  }

  /** Variables whose scopes allow the field: one with no scopes is never offered. */
  #allowed(candidates: readonly BindCandidate[], scope: BindScope): BindCandidate[] {
    return candidates.filter(({ id }) => this.#fields.allows(this.#variables.get(id)?.scopes ?? [], scope));
  }

  /** Every colour and number variable by `TYPE value` in these modes, computed once per set of modes. */
  #valuesIn(modes: ModeMap): Map<string, BindCandidate[]> {
    const signature = this.#raw.collections.map(({ id }) => modes[id] ?? "").join(BIND_VALUE.keyJoint);
    const held = this.#byModes.get(signature);

    if (held !== undefined) {
      return held;
    }

    const values = new Map<string, BindCandidate[]>();

    for (const variable of this.#raw.variables) {
      const key = this.#keyOf(variable, modes);
      const candidate = this.#own.get(variable.id);

      if (key !== null && candidate !== undefined) {
        values.set(key, [...(values.get(key) ?? []), candidate]);
      }
    }

    this.#byModes.set(signature, values);

    return values;
  }

  #keyOf(variable: RawVariable, modes: ModeMap): string | null {
    const value = this.#resolved(variable, modes, BIND_NUMBER.aliasDepth);

    if (variable.resolvedType === VARIABLE_TYPE.color && this.#isChannels(value)) {
      return BIND_TEXT.key(VARIABLE_TYPE.color, this.#values.color(value, 1, this.space));
    }

    return variable.resolvedType === VARIABLE_TYPE.float && typeof value === "number"
      ? BIND_TEXT.key(VARIABLE_TYPE.float, this.#values.round(value))
      : null;
  }

  /** A variable's value in the layer's mode of its collection (else its default), aliases followed. */
  #resolved(
    variable: RawVariable,
    modes: ModeMap,
    depth: number,
  ): unknown {
    const fallback = this.#defaults.get(variable.collectionId) ?? "";
    const value = variable.valuesByMode[modes[variable.collectionId] ?? fallback] ?? variable.valuesByMode[fallback];
    const target = this.#aliasOf(value);

    if (target === undefined) {
      return value;
    }

    const next = this.#variables.get(target);

    return next === undefined || depth === 0 ? undefined : this.#resolved(next, modes, depth - 1);
  }

  /** Candidates without those another candidate is an alias of: the alias is the token a design means. */
  #withoutTargets(candidates: readonly BindCandidate[], modes: ModeMap): BindCandidate[] {
    const targets = new Set(candidates.flatMap(({ id }) => this.#targetsOf(id, modes)));

    return candidates.filter(({ id }) => !targets.has(id));
  }

  /** The variables a variable's value points at in these modes, through every alias. */
  #targetsOf(id: string, modes: ModeMap): string[] {
    const targets: string[] = [];
    let variable = this.#variables.get(id);

    for (let depth = 0; variable !== undefined && depth < BIND_NUMBER.aliasDepth; depth++) {
      const mode = modes[variable.collectionId] ?? this.#defaults.get(variable.collectionId) ?? "";
      const target = this.#aliasOf(variable.valuesByMode[mode]);

      if (target === undefined) {
        break;
      }

      targets.push(target);
      variable = this.#variables.get(target);
    }

    return targets;
  }

  /** The id an alias `{ type: "VARIABLE_ALIAS", id }` points at. */
  #aliasOf(value: unknown): string | undefined {
    if (typeof value !== "object" || value === null || !("type" in value) || value.type !== BIND_VALUE.alias) {
      return undefined;
    }

    return "id" in value && typeof value.id === "string" ? value.id : undefined;
  }

  #isChannels(value: unknown): value is Channels {
    return typeof value === "object" && value !== null && "r" in value && "g" in value && "b" in value;
  }
}

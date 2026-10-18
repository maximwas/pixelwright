import { isChannels } from "../../kernel/color/color.ts";
import { type ColorSpace, colorSpaceOf } from "../../kernel/color/color-space.ts";
import { styleName, styleTokenName, variableTokenName } from "../../kernel/names.ts";
import { roundTo } from "../../kernel/numbers.ts";
import type { SnapshotStyle } from "../../types/snapshot.ts";
import type { RawStyle, RawTokens, RawVariable } from "../raw-tokens.ts";
import { type BindScope, scopeAllows, variableAmount } from "./fields.ts";
import { colorValue, effectsValue, type TextParts, textValue } from "./values.ts";

/** A style or variable a raw value may be bound to, named by its token as design_read writes it. */
export interface BindCandidate {
  readonly token: string;
  readonly id: string;
  readonly source: "variable" | "style";
  /** A variable's resolved type (COLOR, FLOAT…), a style's kind (PAINT, TEXT, EFFECT). */
  readonly type: string;
  /** The variable a paint style's one paint is bound to: the style is that variable under another name. */
  readonly wraps?: string;
}

/** A layer's variable modes, collection id → mode id (Figma's resolvedVariableModes). */
export type ModeMap = Readonly<Record<string, string>>;

/** Aliases followed at most this deep. */
const ALIAS_DEPTH = 8;

const isAlias = (value: unknown): value is { id: string } =>
  typeof value === "object" &&
  value !== null &&
  (value as { type?: unknown }).type === "VARIABLE_ALIAS" &&
  typeof (value as { id?: unknown }).id === "string";

/**
 * The file's tokens by the values they hold, for binding raw values: colour and number variables per variable mode
 * (aliases followed), paint styles of one solid paint, text styles and effect styles by the value design_read writes.
 * One index serves one call.
 */
export class BindIndex {
  readonly #raw: RawTokens;
  readonly #space: ColorSpace;
  readonly #variables: Map<string, RawVariable>;
  readonly #defaults: Map<string, string>;
  readonly #own = new Map<string, BindCandidate>();
  readonly #byId = new Map<string, BindCandidate>();
  readonly #styles = new Map<string, Map<string, BindCandidate[]>>();
  readonly #byToken = new Map<string, BindCandidate[]>();
  readonly #byModes = new Map<string, Map<string, BindCandidate[]>>();

  private constructor(raw: RawTokens) {
    this.#raw = raw;
    this.#space = colorSpaceOf(raw.colorProfile);
    this.#variables = new Map(raw.variables.map((variable) => [variable.id, variable]));
    this.#defaults = new Map(raw.collections.map((collection) => [collection.id, collection.defaultModeId]));
  }

  static of(raw: RawTokens): BindIndex {
    const index = new BindIndex(raw);

    index.#indexVariables();
    index.#indexStyles();

    return index;
  }

  /**
   * The tokens holding a colour for a field of this scope in the layer's modes: colour variables, then paint styles of
   * one solid paint when the layer has only the one paint (a paint style is the whole list). A variable an alias among
   * them points at is left out (the alias is the token meant), and so is a style wrapping a variable among them.
   */
  colors(value: string, { scope, modes, stylable }: { scope: BindScope; modes: ModeMap; stylable: boolean }) {
    const variables = (this.#valuesIn(modes).get(`COLOR ${value}`) ?? []).filter((candidate) =>
      scopeAllows(this.#variables.get(candidate.id)?.scopes ?? [], scope),
    );
    const held = new Set(variables.map((candidate) => candidate.id));
    const styles = stylable
      ? (this.#styles.get("PAINT")?.get(value) ?? []).filter(({ wraps }) => wraps === undefined || !held.has(wraps))
      : [];

    return [...this.#withoutTargets(variables, modes), ...styles];
  }

  /**
   * The number variables holding a field's value in the layer's modes, as a variable bound to a field of this scope
   * holds it (an opacity as a percent), aliases preferred.
   */
  numbers(value: number, { scope, modes }: { scope: BindScope; modes: ModeMap }): BindCandidate[] {
    const amount = roundTo(variableAmount(scope, value), 2);
    const variables = (this.#valuesIn(modes).get(`FLOAT ${amount}`) ?? []).filter((candidate) =>
      scopeAllows(this.#variables.get(candidate.id)?.scopes ?? [], scope),
    );

    return this.#withoutTargets(variables, modes);
  }

  /** The text styles setting these parts, by textValue. */
  texts(value: string): BindCandidate[] {
    return this.#styles.get("TEXT")?.get(value) ?? [];
  }

  /** The effect styles holding these effects, by effectsValue. */
  effects(value: string): BindCandidate[] {
    return this.#styles.get("EFFECT")?.get(value) ?? [];
  }

  /** The styles and variables a token names (a text style also by its own name, as textStyle writes it). */
  byToken(token: string): BindCandidate[] {
    return this.#byToken.get(token.trim()) ?? [];
  }

  /** A style or variable by its id (a library's variable the file uses among them). */
  byId(id: string): BindCandidate | undefined {
    return this.#byId.get(id);
  }

  #indexVariables(): void {
    for (const variable of this.#raw.variables) {
      const candidate: BindCandidate = {
        token: variableTokenName(variable),
        id: variable.id,
        source: "variable",
        type: variable.resolvedType,
      };

      this.#own.set(variable.id, candidate);
      this.#name(candidate.token, candidate);
    }

    for (const [id, variable] of Object.entries(this.#raw.external)) {
      this.#name(variableTokenName(variable), {
        token: variableTokenName(variable),
        id,
        source: "variable",
        type: variable.resolvedType,
      });
    }
  }

  #indexStyles(): void {
    for (const style of this.#raw.styles) {
      const value = this.#styleValue(style);
      const candidate = styleCandidate(style);

      this.#name(candidate.token, candidate);

      if (style.type === "TEXT") {
        this.#name(styleName(style), candidate);
      }

      if (value !== null) {
        const byValue = this.#styles.get(style.type) ?? new Map<string, BindCandidate[]>();

        byValue.set(value, [...(byValue.get(value) ?? []), candidate]);
        this.#styles.set(style.type, byValue);
      }
    }
  }

  /** A style's value as design_read writes a layer that matches it; null when it is none a raw value can equal. */
  #styleValue(style: SnapshotStyle): string | null {
    if (style.type === "PAINT") {
      const visible = (style.paints ?? []).filter((paint) => paint.visible ?? true);
      const [paint] = visible;

      return visible.length === 1 && paint?.type === "SOLID" && paint.color !== undefined
        ? colorValue(paint.color, paint.opacity ?? 1, this.#space)
        : null;
    }

    if (style.type === "EFFECT") {
      return effectsValue(style.effects ?? [], this.#space);
    }

    return style.type === "TEXT" ? textOf(style) : null;
  }

  #name(token: string, candidate: BindCandidate): void {
    this.#byId.set(candidate.id, candidate);

    const named = this.#byToken.get(token) ?? [];

    if (!named.some(({ id }) => id === candidate.id)) {
      this.#byToken.set(token, [...named, candidate]);
    }
  }

  /** Every colour and number variable by `TYPE value` in these modes, computed once per set of modes. */
  #valuesIn(modes: ModeMap): Map<string, BindCandidate[]> {
    const signature = this.#raw.collections.map(({ id }) => modes[id] ?? "").join(" ");
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
    const value = this.#resolved(variable, modes, ALIAS_DEPTH);

    if (variable.resolvedType === "COLOR" && isChannels(value)) {
      return `COLOR ${colorValue(value, 1, this.#space)}`;
    }

    return variable.resolvedType === "FLOAT" && typeof value === "number" ? `FLOAT ${roundTo(value, 2)}` : null;
  }

  /** A variable's value in the layer's mode of its collection (else its default), aliases followed. */
  #resolved(variable: RawVariable, modes: ModeMap, depth: number): unknown {
    const mode = modes[variable.collectionId] ?? this.#defaults.get(variable.collectionId) ?? "";
    const value = variable.valuesByMode[mode] ?? variable.valuesByMode[this.#defaults.get(variable.collectionId) ?? ""];

    if (!isAlias(value)) {
      return value;
    }

    const target = this.#variables.get(value.id);

    return target === undefined || depth === 0 ? undefined : this.#resolved(target, modes, depth - 1);
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

    for (let depth = 0; variable !== undefined && depth < ALIAS_DEPTH; depth++) {
      const mode = modes[variable.collectionId] ?? this.#defaults.get(variable.collectionId) ?? "";
      const value = variable.valuesByMode[mode];

      if (!isAlias(value)) {
        break;
      }

      targets.push(value.id);
      variable = this.#variables.get(value.id);
    }

    return targets;
  }
}

function styleCandidate(style: RawStyle): BindCandidate {
  const wraps = style.type === "PAINT" ? style.paints?.[0]?.boundVariables?.color : undefined;
  const id = isAlias(wraps) ? wraps.id : undefined;

  return {
    token: style.type === "TEXT" ? `${styleTokenName(style)}-font` : styleTokenName(style),
    id: style.id,
    source: "style",
    type: style.type,
    ...(id === undefined ? {} : { wraps: id }),
  };
}

/** A text style's value, when it has the parts a text's are compared on. */
function textOf(style: SnapshotStyle): string | null {
  const { fontName, fontSize, lineHeight, letterSpacing } = style;

  if (fontName === undefined || fontSize === undefined || lineHeight === undefined) {
    return null;
  }

  const parts: TextParts = {
    fontName,
    fontSize,
    lineHeight,
    letterSpacing: letterSpacing ?? {
      unit: "PIXELS",
      value: 0,
    },
    textCase: style.textCase ?? "ORIGINAL",
    textDecoration: style.textDecoration ?? "NONE",
  };

  return textValue(parts);
}

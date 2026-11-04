import { InjectionToken, inject, injectable } from "@needle-di/core";
import { type Channels, Color, type ColorSpace } from "@/core/kernel/color/color.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import { DTCG_KEY, DTCG_NOTE, DTCG_NUMBER, DTCG_TYPE } from "@/core/tokens/formats/dtcg/dtcg.constants.ts";
import type {
  DtcgColor,
  DtcgDimension,
  DtcgToken,
  DtcgType,
  DtcgWriting,
} from "@/core/tokens/formats/dtcg/dtcg.types.ts";
import { DTCG_REFERENCES } from "@/core/tokens/formats/dtcg/dtcg-references.ts";
import { NUMBER_UNITS } from "@/core/tokens/model/number-units.ts";
import type { RawCollection, RawVariable } from "@/shared/ops/variables/variables.schema.ts";

type RawMode = RawCollection["modes"][number];

/** A composed colour as Figma keeps it: a colour and an opacity, either of them a variable. */
interface Composed {
  readonly color: unknown;
  readonly opacity: unknown;
}

/**
 * Values as DTCG writes them (K-016): a variable's token in one mode, a colour as `{colorSpace, components, alpha,
 * hex}` in the file's space with the sRGB hex as its fallback, a length in px, numbers to four decimals.
 */
@injectable()
export class DtcgValues {
  readonly #format;
  readonly #units;
  readonly #references;

  constructor(
    format = inject(NUMBER_FORMAT),
    units = inject(NUMBER_UNITS),
    references = inject(DTCG_REFERENCES),
  ) {
    this.#format = format;
    this.#units = units;
    this.#references = references;
  }

  /**
   * A variable's token in one mode: an alias as a reference `{path}`; else its value as its type holds it, a composed
   * colour as one colour with its alpha (a variable in it resolved through the mode, said in a note), or, when its
   * colour cannot be resolved, a reference to that colour without its opacity. Null, noted, when it has no DTCG type
   * or no value its type can hold.
   */
  token(
    variable: RawVariable,
    mode: RawMode,
    writing: DtcgWriting,
  ): DtcgToken | null {
    const type = writing.places.types.get(variable.id) ?? null;

    if (type === null) {
      writing.untyped.set(variable.name, variable.resolvedType);

      return null;
    }

    const value = variable.valuesByMode[mode.modeId];
    const alias = this.#units.alias(value);
    const literal = alias === null ? this.#literal(type, value, mode.modeId, writing) : null;

    if (literal !== null) {
      if (this.#mixesVariable(value)) {
        writing.unwritten.add(DTCG_NOTE.resolved(variable.name, mode.name));
      }

      return this.#made(variable, type, literal);
    }

    const target = alias ?? (this.#isComposed(value) ? this.#units.alias(value.color) : null);

    if (target === null) {
      writing.unwritten.add(DTCG_NOTE.unwritable(variable.name, mode.name));

      return null;
    }

    if (alias === null) {
      writing.unwritten.add(DTCG_NOTE.unfaded(variable.name, mode.name));
    }

    const reference = this.#reference(variable, target, writing);

    return reference === null ? null : this.#made(variable, type, reference);
  }

  /** A Figma colour faded by an opacity: its space's components, alpha when see-through, the sRGB hex (P3 clipped). */
  color(
    channels: Channels,
    opacity: number,
    space: ColorSpace,
  ): DtcgColor {
    const color = Color.of(channels, space).faded(opacity);
    const alpha = this.number(color.alpha);

    return {
      colorSpace: space,
      components: [this.number(color.red), this.number(color.green), this.number(color.blue)],
      ...(alpha < DTCG_NUMBER.opaque ? { alpha } : {}),
      hex: color.hex(),
    };
  }

  px(value: number): DtcgDimension {
    return { value: this.number(value), unit: DTCG_KEY.px };
  }

  number(value: number): number {
    return this.#format.round(value, PRECISION.dtcg);
  }

  #made(
    variable: RawVariable,
    type: DtcgType,
    value: unknown,
  ): DtcgToken {
    return {
      $type: type,
      $value: value,
      ...(variable.description === undefined || variable.description === ""
        ? {}
        : { $description: variable.description }),
    };
  }

  /** The reference to an alias's target, noting a target no tree here holds; null, noted, for one found nowhere. */
  #reference(
    variable: RawVariable,
    target: string,
    writing: DtcgWriting,
  ): string | null {
    const reference = writing.places.references.get(target);

    if (reference === undefined) {
      writing.lost.add(variable.name);

      return null;
    }

    const elsewhere = this.#references.outside(writing.raw, writing.written, target);

    if (elsewhere !== null) {
      writing.outside.set(variable.name, DTCG_NOTE.outside(variable.name, elsewhere));
    }

    return reference;
  }

  /** A value as its type holds it; null for one it cannot hold. */
  #literal(
    type: DtcgType,
    value: unknown,
    mode: string,
    writing: DtcgWriting,
  ): unknown {
    switch (type) {
      case DTCG_TYPE.color:
        return this.#color(value, mode, writing);
      case DTCG_TYPE.dimension:
        return typeof value === "number" ? this.px(value) : null;
      case DTCG_TYPE.fontFamily:
        return typeof value === "string" ? value : null;
      default:
        return typeof value === "number" ? value : null;
    }
  }

  /** A colour, or a composed one as one colour: its colour faded by its opacity, each resolved through the mode. */
  #color(
    value: unknown,
    mode: string,
    writing: DtcgWriting,
  ): DtcgColor | null {
    if (this.#isChannels(value)) {
      return this.color(value, DTCG_NUMBER.opaque, writing.space);
    }

    if (!this.#isComposed(value)) {
      return null;
    }

    const channels = this.#resolved(value.color, mode, writing);
    const opacity = this.#resolved(value.opacity, mode, writing);

    if (!this.#isChannels(channels) || typeof opacity !== "number") {
      return null;
    }

    // Figma keeps the opacity in percent; a value up to 1 is a fraction already (as the CSS reads it).
    return this.color(channels, opacity > DTCG_NUMBER.opaque ? opacity / DTCG_NUMBER.percent : opacity, writing.space);
  }

  /** A value with its aliases followed: through the same mode, or another collection's default; null for none. */
  #resolved(
    value: unknown,
    mode: string,
    writing: DtcgWriting,
  ): unknown {
    let current = value;
    let modeId = mode;

    for (let hop = 0; hop < DTCG_NUMBER.aliasHops; hop++) {
      const id = this.#units.alias(current);
      const target = id === null ? undefined : writing.variables.get(id);

      if (target === undefined) {
        return id === null ? current : null;
      }

      const home = writing.raw.collections.find((collection) => collection.id === target.collectionId);

      modeId = modeId in target.valuesByMode ? modeId : (home?.defaultModeId ?? modeId);
      current = target.valuesByMode[modeId];
    }

    return null;
  }

  #mixesVariable(value: unknown): boolean {
    return this.#isComposed(value) && (this.#units.alias(value.color) ?? this.#units.alias(value.opacity)) !== null;
  }

  #isComposed(value: unknown): value is Composed {
    return typeof value === "object" && value !== null && "color" in value && "opacity" in value;
  }

  #isChannels(value: unknown): value is Channels {
    return typeof value === "object" && value !== null && "r" in value && "g" in value && "b" in value;
  }
}

export const DTCG_VALUES = new InjectionToken<DtcgValues>("DtcgValues");

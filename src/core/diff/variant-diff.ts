import { InjectionToken, inject, injectable } from "@needle-di/core";
import { sortBy } from "es-toolkit";
import { DESIGN_DIFF } from "@/core/diff/design-diff.ts";
import { DIFF_TEXT, STATE_PSEUDO, VARIANTS } from "@/core/diff/diff.constants.ts";
import type { VariantsView } from "@/core/diff/diff.schema.ts";
import { NAME_VALUE_LIST } from "@/core/kernel/lists/name-value-list.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

type Values = Readonly<Record<string, string>>;
type VariantView = VariantsView["variants"][number];

/**
 * A component set's variants against its default (T-086, K-053): the top-left variant, as Figma takes it; each other
 * one against the variant it differs from by a single property (a state first), as DesignDiff says it, with its
 * properties (the one Name=Value parser, K-069) and the CSS pseudo-class a state value suggests.
 */
@injectable()
export class VariantDiff {
  readonly #diff;
  readonly #lists;

  constructor(diff = inject(DESIGN_DIFF), lists = inject(NAME_VALUE_LIST)) {
    this.#diff = diff;
    this.#lists = lists;
  }

  view(model: ReadModel): VariantsView {
    const { root } = model;
    const variants = (root.children ?? []).filter((child) => child.type === VARIANTS.componentType);
    const [first] = sortBy(variants, [({ y }) => y, ({ x }) => x]);

    if (first === undefined) {
      throw new PixelwrightError(ERROR_CODE.opFailed, DIFF_TEXT.noVariants(root.name));
    }

    const others = variants.filter((variant) => variant !== first);

    return {
      set: { id: root.id, name: root.name },
      properties: this.#properties(variants),
      default: { id: first.id, name: first.name },
      variants: others.slice(0, VARIANTS.max).map((variant) => this.#variant(model, variant, variants, first)),
      ...(others.length > VARIANTS.max ? { more: others.length - VARIANTS.max } : {}),
    };
  }

  /** Each variant property's values across the set, in the order the variants give them. */
  #properties(variants: readonly ReadLayer[]): Record<string, string[]> {
    const properties: Record<string, string[]> = {};

    for (const variant of variants) {
      for (const [name, value] of Object.entries(this.#props(variant))) {
        properties[name] = [...new Set([...(properties[name] ?? []), value])];
      }
    }

    return properties;
  }

  /** A variant against the one it differs from by a single property (else the default): what changes, its state. */
  #variant(
    model: ReadModel,
    variant: ReadLayer,
    variants: readonly ReadLayer[],
    first: ReadLayer,
  ): VariantView {
    const props = this.#props(variant);
    const against = this.#baseline(props, variants, this.#props(first)) ?? first;
    const theirs = this.#props(against);
    const diff = this.#diff.diff({ ...model, root: against }, { ...model, root: variant });
    const pseudo = Object.entries(props)
      .filter(([name, value]) => theirs[name] !== value)
      .map(([, value]) => this.#pseudo(value))
      .find((found) => found !== undefined);

    return {
      id: variant.id,
      name: variant.name,
      props,
      against: { id: against.id, name: against.name },
      ...(pseudo === undefined ? {} : { pseudo }),
      same: diff.same,
      changed: diff.changed.slice(0, VARIANTS.diffMax),
      onlyInDefault: diff.onlyInA.slice(0, VARIANTS.diffMax),
      onlyInVariant: diff.onlyInB.slice(0, VARIANTS.diffMax),
    };
  }

  /**
   * The variant to compare one with: the one it differs from in a single property, set there as on the default, a
   * state first (Size=Large, State=Hover against Size=Large, State=Default). None such: undefined.
   */
  #baseline(
    props: Values,
    variants: readonly ReadLayer[],
    base: Values,
  ): ReadLayer | undefined {
    const candidates = variants.flatMap((other) => {
      const theirs = this.#props(other);
      const apart = Object.keys({ ...props, ...theirs }).filter((name) => props[name] !== theirs[name]);
      const [only] = apart;

      return apart.length === 1 && only !== undefined && theirs[only] === base[only]
        ? [{ other, state: this.#pseudo(props[only] ?? "") !== undefined }]
        : [];
    });

    return (candidates.find(({ state }) => state) ?? candidates[0])?.other;
  }

  #pseudo(value: string): string | undefined {
    return STATE_PSEUDO.find(({ pattern }) => pattern.test(value.trim()))?.pseudo;
  }

  /** A variant's properties from its name, as Figma writes it: "State=Hover, Size=Large". */
  #props(variant: ReadLayer): Record<string, string> {
    return this.#lists.parse(variant.name) ?? {};
  }
}

export const VARIANT_DIFF = new InjectionToken<VariantDiff>("VariantDiff");

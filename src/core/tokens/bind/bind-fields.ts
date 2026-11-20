import { InjectionToken, injectable } from "@needle-di/core";
import {
  BIND_LAYOUT,
  BIND_NUMBER,
  BIND_SCOPE,
  BIND_VALUE,
  FIELD_GROUPS,
  FIELD_RULE,
  FRAME_FILL_TYPES,
  NUMBER_FIELDS,
} from "@/core/tokens/bind/bind.constants.ts";
import type { BindScope, FieldGroup, FieldRule, NumberUse } from "@/core/tokens/bind/bind.types.ts";
import { VARIABLE_VALUE } from "@/core/tokens/model/model.constants.ts";
import { ALL_FILLS, FILL_SCOPES } from "@/core/tokens/scopes/scopes.constants.ts";
import type { ScannedLayer } from "@/shared/ops/bind/bind.schema.ts";

/**
 * Which fields count, and which variables a field takes (K-027): the one table tokens_bind reads, for design_lint to
 * share. A gap only in a flow that spaces (no space-between), a counter gap only when it wraps, grid gaps on a grid,
 * padding around auto layout, opacity always; radii and border widths as one value when all four agree.
 */
@injectable()
export class BindFields {
  /** The layer's raw numbers: not bound, not zero, an opacity below 1, where its layout uses them. */
  numbers(layer: ScannedLayer): NumberUse[] {
    const single = Object.entries(NUMBER_FIELDS).flatMap(([field, { css, scope, rule }]) =>
      this.#applies(rule, layer.layout) ? [this.#use(layer, [field], css, scope)] : [],
    );
    const grouped = FIELD_GROUPS.flatMap((group) => (group.stroked && !layer.stroked ? [] : this.#group(layer, group)));

    return [...single, ...grouped].filter((use) => use !== null);
  }

  /** The scope a layer's fill takes colour variables of: a text's TEXT_FILL, a frame's FRAME_FILL, else SHAPE_FILL. */
  fillScope(type: string): BindScope {
    if (type === BIND_VALUE.textLayer) {
      return BIND_SCOPE.textFill;
    }

    return FRAME_FILL_TYPES.includes(type) ? BIND_SCOPE.frameFill : BIND_SCOPE.shapeFill;
  }

  /**
   * Whether a variable with these scopes may be bound to a field of this scope (ALL_FILLS covers every fill); one with
   * no scopes is hidden from every picker in Figma, so it is never offered.
   */
  allows(scopes: readonly string[], scope: BindScope): boolean {
    return (
      scopes.includes(VARIABLE_VALUE.allScopes) ||
      scopes.includes(scope) ||
      (FILL_SCOPES.includes(scope) && scopes.includes(ALL_FILLS))
    );
  }

  /** A field's value as the variables bound to it hold it: an opacity as a percent (FX-049). */
  amount(scope: BindScope, value: number): number {
    return scope === BIND_SCOPE.opacity ? value * BIND_NUMBER.percent : value;
  }

  /** One use binding all four fields when they agree, one per field when they differ, else the layer's one field. */
  #group(layer: ScannedLayer, { fields, single, css, scope }: FieldGroup): (NumberUse | null)[] {
    if (!fields.every((field) => layer.numbers[field] !== undefined)) {
      return [this.#use(layer, [single], css, scope)];
    }

    const values = new Set(fields.map((field) => layer.numbers[field]));
    const groups = values.size === 1 ? [fields] : fields.map((field) => [field]);

    return groups.map((group) => this.#use(layer, group, css, scope));
  }

  /** A raw number in the fields: none bound, not zero (nor a full opacity). */
  #use(
    layer: ScannedLayer,
    fields: readonly string[],
    css: string,
    scope: BindScope,
  ): NumberUse | null {
    const [first] = fields;
    const value = first === undefined ? undefined : layer.numbers[first];

    if (
      value === undefined ||
      value <= 0 ||
      (scope === BIND_SCOPE.opacity && value >= 1) ||
      fields.some((field) => layer.bound.includes(field))
    ) {
      return null;
    }

    return { fields, css, scope, value };
  }

  #applies(rule: FieldRule, layout: Readonly<Record<string, string>>): boolean {
    const mode = layout.layoutMode;
    const flows = mode === BIND_LAYOUT.horizontal || mode === BIND_LAYOUT.vertical;
    const rules: Readonly<Record<FieldRule, boolean>> = {
      [FIELD_RULE.flow]: flows && layout.primaryAxisAlignItems !== BIND_LAYOUT.spaceBetween,
      [FIELD_RULE.wrap]: layout.layoutWrap === BIND_LAYOUT.wrap,
      [FIELD_RULE.grid]: mode === BIND_LAYOUT.grid,
      [FIELD_RULE.layout]: mode !== undefined && mode !== BIND_LAYOUT.none,
      [FIELD_RULE.always]: true,
    };

    return rules[rule];
  }
}

export const BIND_FIELDS = new InjectionToken<BindFields>("BindFields");

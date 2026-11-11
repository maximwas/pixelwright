import { InjectionToken, inject, injectable } from "@needle-di/core";
import { ATTRIBUTE, CHANGE_KIND, CSS_ATTRIBUTES } from "@/core/apply/apply.constants.ts";
import type { ApplyChange, ApplyElement, ApplyError } from "@/core/apply/apply.types.ts";
import { PLAN_VALUE } from "@/core/apply/plan/plan.constants.ts";
import type { LayerNow } from "@/core/apply/plan/plan.types.ts";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { WriteInput } from "@/core/css/css.types.ts";
import { ChangeOutput } from "@/core/css/registry/change-output.ts";
import { WRITE_REGISTRY } from "@/core/css/registry/write-registry.ts";

/**
 * An element as a change in Figma's terms (C-171): what the writers make of it (with `now`, only what the layer does
 * not have yet), in the envelope the plugin places it by. Errors stand where the XML has them and come in the order of
 * the element's attributes. `placed`: nothing lays the layer out where it goes.
 */
@injectable()
export class ChangeOf {
  readonly #registry;

  constructor(registry = inject(WRITE_REGISTRY)) {
    this.#registry = registry;
  }

  of(
    element: ApplyElement,
    now?: LayerNow,
    placed = false,
  ): { change: ApplyChange; errors: ApplyError[] } {
    const { attributes } = element;
    const out = new ChangeOutput();

    this.#registry.write(this.#input(element, now, placed), out);

    const order = Object.keys(attributes);
    const rank = (error: ApplyError) => {
      const index = error.attribute === undefined ? -1 : order.indexOf(error.attribute);

      return index === -1 ? order.length : index;
    };
    const errors = out.problems.map(
      (problem): ApplyError => ({
        line: element.line,
        column: element.column,
        ...(element.id === null ? {} : { id: element.id }),
        ...problem,
      }),
    );

    return {
      change: {
        line: element.line,
        column: element.column,
        kind: element.id === null && element.source === undefined ? CHANGE_KIND.create : CHANGE_KIND.update,
        ref: element.ref,
        id: element.id,
        tag: element.tag,
        parent: element.parent,
        index: element.index,
        ...(attributes.before === undefined ? {} : { before: attributes.before }),
        ...(attributes.after === undefined ? {} : { after: attributes.after }),
        props: out.props,
        sources: out.sources,
        ...(attributes.copyOf === undefined ? {} : { copyOf: attributes.copyOf }),
        ...(element.source === undefined ? {} : { source: element.source }),
        ...(element.copy === undefined ? {} : { copy: element.copy }),
      },
      errors: [...errors].sort((first, second) => rank(first) - rank(second)),
    };
  }

  /** The CSS attributes of the element no writer handles yet: they are not in the change, and the dry run says so. */
  unwritten(element: ApplyElement): string[] {
    return Object.keys(element.attributes).filter((name) => CSS_ATTRIBUTES.has(name) && !this.#registry.owns(name));
  }

  /** What a write rule reads: the element's attributes, and the same over what the layer has now. */
  #input(
    element: ApplyElement,
    now: LayerNow | undefined,
    placed: boolean,
  ): WriteInput {
    const { attributes } = element;
    // Where nothing lays a layer out its edges place it, as design_read's position="absolute" there says.
    const current: Readonly<Record<string, string>> = {
      ...(placed ? { [CSS_PROPERTY.position]: PLAN_VALUE.absolute } : {}),
      ...now?.current,
    };

    return {
      tag: element.tag,
      own: (name) => attributes[name],
      merged: (name) => attributes[name] ?? current[name],
      changed: (name) =>
        name !== ATTRIBUTE.id && attributes[name] !== undefined && !(now?.attributes.has(name) ?? false),
      hidden: now !== undefined && !now.visible,
      existing: now !== undefined,
    };
  }
}

export const CHANGE_OF = new InjectionToken<ChangeOf>("ChangeOf");

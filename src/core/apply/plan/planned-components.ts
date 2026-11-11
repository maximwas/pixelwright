import { CHANGE_KIND } from "@/core/apply/apply.constants.ts";
import type { ApplyChange } from "@/core/apply/apply.types.ts";
import { PLAN_TEXT, PLAN_VALUE } from "@/core/apply/plan/plan.constants.ts";
import { TAG } from "@/core/xml/tags.constants.ts";

type Variants = Readonly<Record<string, string>>;

/**
 * On a dry run, what the creates make for the instances after them, by name (C-178): a set with its variants as they
 * come, a lone component, or a copied one whose variants are unknown.
 */
// shortcut: no writer makes name/variant props yet, so nothing reads has/missingVariant; items 38-39 wire the check.
export class PlannedComponents {
  readonly #planned = new Map<string, Variants[] | null>();

  /** Whether the XML makes a component or set of this name. */
  has(name: string): boolean {
    return this.#planned.has(name);
  }

  /** Notes what a create makes: a set or a lone component by its name, a set's variant under its set. */
  record(change: ApplyChange, byRef: ReadonlyMap<string, ApplyChange>): void {
    const holder = byRef.get(change.parent ?? "");

    if (change.kind !== CHANGE_KIND.create) {
      return;
    }

    if (change.tag === TAG.COMPONENT && holder?.tag === TAG.COMPONENT_SET) {
      const set = holder.kind === CHANGE_KIND.create ? this.#planned.get(holder.props.name ?? "") : undefined;

      set?.push({ ...change.props.variant });
    } else if ((change.tag === TAG.COMPONENT_SET || change.tag === TAG.COMPONENT) && change.props.name !== undefined) {
      this.#planned.set(change.props.name, change.tag === TAG.COMPONENT_SET && change.copyOf === undefined ? [] : null);
    }
  }

  /**
   * Why an instance of a set the XML makes cannot have these values (the rest its first variant's, the set's default),
   * or null when it can: a lone or copied component takes any.
   */
  missingVariant(name: string, wanted: Variants): string | null {
    const variants = this.#planned.get(name);

    if (variants === undefined || variants === null) {
      return null;
    }

    const target = { ...variants[0], ...wanted };

    return variants.some((values) => Object.entries(target).every(([key, value]) => values[key] === value))
      ? null
      : PLAN_TEXT.variants(
        name,
        this.#named(wanted),
        variants.map((values) => this.#named(values)).join(PLAN_VALUE.variantsJoint),
      );
  }

  /** A variant's name as Figma writes it: "Size=Large, State=Default". */
  #named(values: Variants): string {
    return Object.entries(values)
      .map(([name, value]) => PLAN_VALUE.variantPair(name, value))
      .join(PLAN_VALUE.variantJoint);
  }
}

import type { ApplyChange } from "../types.ts";

/** A variant's name as Figma writes it: "Size=Large, State=Default". */
function variantName(values: Readonly<Record<string, string>>): string {
  return Object.entries(values)
    .map(([name, value]) => `${name}=${value}`)
    .join(", ");
}

/**
 * On a dry run, what the creates make for the instances after them, by name: a set with its variants as they come, a
 * lone component, or a copied one whose variants are unknown.
 */
export class PlannedComponents {
  readonly #planned = new Map<string, Record<string, string>[] | null>();

  /** Whether the XML makes a component or set of this name. */
  has(name: string): boolean {
    return this.#planned.has(name);
  }

  /** Notes what a create makes: a set or a lone component by its name, a set's variant under its set. */
  record(change: ApplyChange, byRef: ReadonlyMap<string, ApplyChange>): void {
    const name = change.props.name;
    const holder = byRef.get(change.parent ?? "");

    if (change.kind !== "create") {
      return;
    }

    if (change.tag === "Component" && holder?.tag === "ComponentSet") {
      const set = holder.kind === "create" ? this.#planned.get(holder.props.name ?? "") : undefined;

      set?.push({ ...(change.props.variant ?? {}) });
    } else if ((change.tag === "ComponentSet" || change.tag === "Component") && name !== undefined) {
      this.#planned.set(name, change.tag === "ComponentSet" && change.copyOf === undefined ? [] : null);
    }
  }

  /**
   * Why an instance of a set the XML makes cannot have these values (the rest its first variant's, the set's default),
   * or null when it can: a lone or copied component takes any.
   */
  missingVariant(name: string, wanted: Readonly<Record<string, string>>): string | null {
    const variants = this.#planned.get(name);

    if (variants === undefined || variants === null) {
      return null;
    }

    const target = {
      ...variants[0],
      ...wanted,
    };

    return variants.some((values) => Object.entries(target).every(([key, value]) => values[key] === value))
      ? null
      : `${name} has no variant ${variantName(wanted)}: it has ${variants.map((values) => variantName(values)).join("; ")}.`;
  }
}

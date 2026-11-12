import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_TEXT } from "@/core/css/css.constants.ts";
import type { CssScope, PropertyGroup } from "@/core/css/css.types.ts";

/**
 * The mapping table's groups in their order (Registry, C-172): later groups see what earlier ones set. Each CSS
 * attribute has one group; two groups that own the same one are refused when the registry is built.
 */
@injectable()
export class GroupRegistry {
  readonly #groups;

  constructor(groups = inject(PROPERTY_GROUPS, { multi: true })) {
    const owned = groups.flatMap((group) => group.attributes);
    const shared = owned.find((attribute, index) => owned.indexOf(attribute) !== index);

    if (shared !== undefined) {
      throw new Error(CSS_TEXT.sharedAttribute(shared));
    }

    this.#groups = groups;
  }

  read(scope: CssScope): void {
    for (const group of this.#groups) {
      group.read(scope);
    }
  }
}

export const GROUP_REGISTRY = new InjectionToken<GroupRegistry>("GroupRegistry");

/** The property groups in the mapping table's order. */
export const PROPERTY_GROUPS = new InjectionToken<PropertyGroup>("PropertyGroups");

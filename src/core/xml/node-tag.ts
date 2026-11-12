import { InjectionToken, injectable } from "@needle-di/core";
import { TAG, TAG_RULE } from "@/core/xml/tags.constants.ts";

/** A Figma type's tag (§1.2): the vocabulary's, or 0.7.0's rule for a type it lacks, the type in PascalCase. */
@injectable()
export class NodeTag {
  of(type: string): string {
    if (Object.hasOwn(TAG, type)) {
      return TAG[type as keyof typeof TAG];
    }

    return type
      .toLowerCase()
      .split(TAG_RULE.wordSeparator)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("");
  }
}

export const NODE_TAG = new InjectionToken<NodeTag>("NodeTag");

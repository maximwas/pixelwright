import { injectable } from "@needle-di/core";
import type { FieldReader } from "@/plugin/adapters/figma/layer-read/layer-reader.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { INFERRED_GROUPS, INFERRED_WORDS } from "@/shared/read-model/read-model.constants.ts";

/**
 * The variables bound to a layer's own fields (0.7.0's tokens reader, T-163): padding, gap, radius, sizes and the
 * rest as Figma's aliases, which References resolves and the server writes as var(); and Figma's own match for its
 * unbound spacing, radius, stroke and opacity fields where it found exactly one variable (C-153), field to id, which
 * References adds to the read's variables. None when there is neither.
 */
@injectable()
export class VariableFieldReader implements FieldReader {
  read(node: SceneNode): Partial<ReadLayer> {
    const bound: Readonly<Record<string, unknown>> = node.boundVariables ?? {};
    const inferred = this.#inferred(node, bound);

    return {
      // Plugin API objects are frozen: a JSON copy is what goes on the wire anyway.
      ...(Object.keys(bound).length > 0 ? { boundVariables: JSON.parse(JSON.stringify(bound)) } : {}),
      ...(Object.keys(inferred).length > 0 ? { inferred } : {}),
    };
  }

  #inferred(node: SceneNode, bound: Readonly<Record<string, unknown>>): Record<string, string> {
    const matches: Readonly<Record<string, readonly unknown[] | undefined>> =
      "inferredVariables" in node ? (node.inferredVariables ?? {}) : {};
    // A field is bound when it, or a field bound together with it (a radius and its corners), has a variable.
    const isBound = (field: string) =>
      (INFERRED_GROUPS.find((group) => group.includes(field)) ?? [field]).some((member) => bound[member] !== undefined);
    const inferred: Record<string, string> = {};

    for (const field of Object.keys(INFERRED_WORDS)) {
      const [alias, ...others] = matches[field] ?? [];

      const id = typeof alias === "object" && alias !== null && "id" in alias ? alias.id : undefined;

      if (typeof id === "string" && others.length === 0 && !isBound(field)) {
        inferred[field] = id;
      }
    }

    return inferred;
  }
}

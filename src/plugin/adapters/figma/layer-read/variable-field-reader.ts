import { injectable } from "@needle-di/core";
import type { FieldReader } from "@/plugin/adapters/figma/layer-read/layer-reader.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/**
 * The variables bound to a layer's own fields (0.7.0's tokens reader, T-163): padding, gap, radius, sizes and the
 * rest as Figma's aliases, which References resolves and the server writes as var(); none when nothing is bound.
 */
@injectable()
export class VariableFieldReader implements FieldReader {
  read(node: SceneNode): Partial<ReadLayer> {
    const bound = node.boundVariables;

    // Plugin API objects are frozen: a JSON copy is what goes on the wire anyway.
    return bound !== undefined && Object.keys(bound).length > 0
      ? { boundVariables: JSON.parse(JSON.stringify(bound)) }
      : {};
  }
}

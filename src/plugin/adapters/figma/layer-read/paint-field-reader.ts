import { injectable } from "@needle-di/core";
import type { FieldReader } from "@/plugin/adapters/figma/layer-read/layer-reader.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { READ_VALUE } from "@/shared/read-model/read-model.constants.ts";

/**
 * A layer's fills (0.7.0's paints reader): Figma's paints as plain data, bound variables included, or mixed for a
 * text whose runs differ, none when it has none; and the paint style they come from (T-163). The server maps them to CSS.
 */
@injectable()
export class PaintFieldReader implements FieldReader {
  read(node: SceneNode): Partial<ReadLayer> {
    if (!("fills" in node)) {
      return {};
    }

    const style = node.fillStyleId === figma.mixed ? READ_VALUE.mixed : node.fillStyleId;

    return { ...this.#fills(node), ...(style === "" ? {} : { fillStyleId: style }) };
  }

  #fills(node: SceneNode & MinimalFillsMixin): Partial<ReadLayer> {
    if (node.fills === figma.mixed) {
      return { fills: READ_VALUE.mixed };
    }

    // Plugin API paints are frozen objects with readonly arrays: a JSON copy is what goes on the wire anyway.
    return node.fills.length > 0 ? { fills: JSON.parse(JSON.stringify(node.fills)) } : {};
  }
}

import { injectable } from "@needle-di/core";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import type { FieldReader, ReadOptions } from "@/plugin/adapters/figma/layer-read/layer-reader.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { READ_VALUE } from "@/shared/read-model/read-model.constants.ts";

/**
 * A layer's fills (0.7.0's paints reader): Figma's paints as plain data, bound variables included, or mixed for a
 * text whose runs differ, none when it has none; and the paint style they come from (T-163). The server maps them to CSS.
 * Asked for, a vector's paths as a hash (0.7.0's `paths`): two drawings alike in all else differ by it (T-085, K-052).
 */
@injectable()
export class PaintFieldReader implements FieldReader {
  readonly #names = new TokenNames();
  #pathHash = false;

  start({ pathHash }: ReadOptions): void {
    this.#pathHash = pathHash;
  }

  read(node: SceneNode): Partial<ReadLayer> {
    if (!("fills" in node)) {
      return {};
    }

    const style = node.fillStyleId === figma.mixed ? READ_VALUE.mixed : node.fillStyleId;

    return { ...this.#fills(node), ...(style === "" ? {} : { fillStyleId: style }), ...this.#drawing(node) };
  }

  #fills(node: SceneNode & MinimalFillsMixin): Partial<ReadLayer> {
    if (node.fills === figma.mixed) {
      return { fills: READ_VALUE.mixed };
    }

    // Plugin API paints are frozen objects with readonly arrays: a JSON copy is what goes on the wire anyway.
    return node.fills.length > 0 ? { fills: JSON.parse(JSON.stringify(node.fills)) } : {};
  }

  /** Not the paths themselves (an icon's can be long): enough to tell two drawings apart. */
  #drawing(node: SceneNode): Partial<ReadLayer> {
    return this.#pathHash && "vectorPaths" in node && node.vectorPaths.length > 0
      ? { pathHash: this.#names.hash(JSON.stringify(node.vectorPaths)) }
      : {};
  }
}

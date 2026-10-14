import type { DesignXmlOptions, PlannedAsset } from "../../types/design.ts";
import type { SnapshotNode, SnapshotPaint } from "../../types/snapshot.ts";
import { slug } from "../../utils/slug.ts";
import type { Classified } from "../../xml/classify.ts";

/**
 * The files a read plans: a render per asset layer and the original image behind content, one file per image however
 * many layers use it, named after the layer, each name taken once.
 */
export class AssetPlanner {
  readonly #assetsPath: string;
  readonly #assetSrc: ReadonlyMap<string, string> | undefined;
  readonly #assets: PlannedAsset[] = [];
  readonly #fileNames = new Set<string>();
  readonly #backgrounds = new Map<string, string>();

  constructor({ assetsPath, assetSrc }: Pick<DesignXmlOptions, "assetsPath" | "assetSrc">) {
    this.#assetsPath = assetsPath ?? "assets";
    this.#assetSrc = assetSrc;
  }

  /** Plans a layer's file and returns the path the XML refers to (the written one, once files are written). */
  plan(node: SnapshotNode, asset: Classified): string {
    const extension = asset.format.toLowerCase();
    // An instance is named by its variant too: six "Company logo" instances are six different logos.
    const variants = Object.values(node.instance?.properties ?? {})
      .filter((property) => property.type === "VARIANT")
      .map((property) => String(property.value));
    const base = slug([node.name, ...variants].join(" "));
    const src = this.#assetSrc?.get(node.id) ?? `${this.#assetsPath}/${this.#fileName(base, extension)}`;

    this.#assets.push({
      node: node.id,
      kind: asset.kind,
      format: asset.format,
      src,
      ...(asset.scale === undefined ? {} : { scale: asset.scale }),
    });

    return src;
  }

  /** An image fill behind content: the original image, one file per image however many layers use it. */
  background(node: SnapshotNode, paint: SnapshotPaint): string {
    const hash = paint.imageHash ?? node.id;
    const known = this.#backgrounds.get(hash);

    if (known !== undefined) {
      return known;
    }

    const src =
      this.#assetSrc?.get(`${node.id}#${hash}`) ??
      `${this.#assetsPath}/${this.#fileName(`${slug(node.name)}-background`, "png")}`;

    this.#backgrounds.set(hash, src);
    this.#assets.push({
      node: node.id,
      kind: "image",
      format: "PNG",
      src,
      ...(paint.imageHash === undefined || paint.imageHash === null ? {} : { imageHash: paint.imageHash }),
    });

    return src;
  }

  assets(): PlannedAsset[] {
    return this.#assets;
  }

  #fileName(base: string, extension: string): string {
    let name = `${base}.${extension}`;

    for (let index = 2; this.#fileNames.has(name); index++) {
      name = `${base}-${index}.${extension}`;
    }

    this.#fileNames.add(name);

    return name;
  }
}

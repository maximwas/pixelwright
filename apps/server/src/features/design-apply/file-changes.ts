import { type ApplyElement, type Assessment, type FileChanges, type SnapshotNode, urlsOf } from "@pixelwright/core";
import type { WrittenFiles } from "../../assets/written-files.ts";
import type { SourceFiles } from "./source-files.ts";

/** The files design_read and assets_export wrote, as renders of layers: read at most once per call, when needed. */
export class KnownRenders {
  readonly #files: WrittenFiles;
  #known: Promise<ReadonlyMap<string, readonly string[]>> | null = null;

  constructor(files: WrittenFiles) {
    this.#files = files;
  }

  /** Whether these bytes are a file written for this layer: a render of it, not the image inside. */
  async isRenderOf(sha1: string, layer: string): Promise<boolean> {
    this.#known ??= this.#files.read();

    return ((await this.#known).get(sha1) ?? []).includes(layer);
  }
}

/**
 * What the files each compared element names change, by ref: the attributes whose file holds another image than the
 * layer's (an Image's src, a background's url()s), and why a file cannot be used.
 */
export async function fileChangesOf(
  assessed: readonly Assessment[],
  sources: SourceFiles,
  renders: KnownRenders,
): Promise<Map<string, FileChanges>> {
  const changes = new Map<string, FileChanges>();

  for (const { element, entry, now } of assessed) {
    if (entry !== undefined && now !== undefined) {
      changes.set(element.ref, await filesChanged(element, new LayerImages(entry.node, now.current, sources, renders)));
    }
  }

  return changes;
}

async function filesChanged(element: ApplyElement, images: LayerImages): Promise<FileChanges> {
  const changed: string[] = [];
  const src = element.attributes.src;

  if (element.tag === "Image" && src !== undefined && (await images.differs("src", src))) {
    changed.push("src");
  }

  for (const path of urlsOf(element.attributes.background ?? "")) {
    if (await images.differs("background", path)) {
      changed.push("background");
      break;
    }
  }

  return {
    changed,
    problems: images.problems,
  };
}

/**
 * One layer's images, against the files an element names. A file is the same image when its bytes are the layer's
 * (their SHA-1 is Figma's image hash) or a file design_read or assets_export wrote for this layer, wherever it went. A
 * file that is not there is fine only as the path design_read writes, which it plans without writing when no assetsDir
 * is given.
 */
class LayerImages {
  readonly problems: { attribute: string; message: string }[] = [];
  readonly #node: SnapshotNode;
  readonly #planned: ReadonlySet<string>;
  readonly #hashes: ReadonlySet<string>;
  readonly #sources: SourceFiles;
  readonly #renders: KnownRenders;

  constructor(
    node: SnapshotNode,
    current: Readonly<Record<string, string>>,
    sources: SourceFiles,
    renders: KnownRenders,
  ) {
    this.#node = node;
    this.#planned = new Set([...(current.src === undefined ? [] : [current.src]), ...urlsOf(current.background ?? "")]);
    this.#hashes = new Set(
      (Array.isArray(node.fills) ? node.fills : []).flatMap((paint) =>
        typeof paint.imageHash === "string" ? [paint.imageHash] : [],
      ),
    );
    this.#sources = sources;
    this.#renders = renders;
  }

  /** Whether the file at this path holds another image than the layer's; one that cannot be used is a problem. */
  async differs(attribute: string, path: string): Promise<boolean> {
    const read = await this.#sources.read(path, "image");

    if ("problem" in read) {
      if (read.problem === "unusable" || !this.#planned.has(path)) {
        this.problems.push({
          attribute,
          message: read.message,
        });
      }

      return false;
    }

    return !this.#hashes.has(read.file.sha1) && !(await this.#renders.isRenderOf(read.file.sha1, this.#node.id));
  }
}

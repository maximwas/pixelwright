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
 * layer's (an Image's src, a background's url()s), and why a file cannot be used. An Icon's drawing is never replaced:
 * its src may only name the file design_read planned or wrote for it.
 */
export async function fileChangesOf(
  assessed: readonly Assessment[],
  sources: SourceFiles,
  renders: KnownRenders,
): Promise<Map<string, FileChanges>> {
  const changes = new Map<string, FileChanges>();

  for (const { element, entry, now } of assessed) {
    if (entry !== undefined && now !== undefined) {
      changes.set(element.ref, await filesChanged(element, new LayerFiles(entry.node, now.current, sources, renders)));
    }
  }

  return changes;
}

async function filesChanged(element: ApplyElement, layer: LayerFiles): Promise<FileChanges> {
  const changed: string[] = [];
  const src = element.attributes.src;

  if (element.tag === "Image" && src !== undefined && (await layer.differs("src", src))) {
    changed.push("src");
  }

  if (element.tag === "Icon" && src !== undefined) {
    await layer.checkDrawing("src", src);
  }

  for (const path of urlsOf(element.attributes.background ?? "")) {
    if (await layer.differs("background", path)) {
      changed.push("background");
      break;
    }
  }

  return {
    changed,
    problems: layer.problems,
  };
}

/**
 * One layer, against the files an element names. A file is the same image when its bytes are the layer's (their SHA-1
 * is Figma's image hash) or a file design_read or assets_export wrote for this layer, wherever it went. A file that is
 * not there is fine only as the path design_read writes, which it plans without writing when no assetsDir is given:
 * with any number design_read adds to a name taken earlier in the read, as that depends on what the read held.
 */
class LayerFiles {
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
    this.#planned = new Set(
      [...(current.src === undefined ? [] : [current.src]), ...urlsOf(current.background ?? "")].map(unnumbered),
    );
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
      if (read.problem === "unusable" || !this.#isPlanned(path)) {
        this.#problem(attribute, read.message);
      }

      return false;
    }

    return !this.#hashes.has(read.file.sha1) && !(await this.#renders.isRenderOf(read.file.sha1, this.#node.id));
  }

  /** An Icon's file: its own (the planned path, or a render of it) or a problem, since its drawing is not replaced. */
  async checkDrawing(attribute: string, path: string): Promise<void> {
    if (this.#isPlanned(path)) {
      return;
    }

    const read = await this.#sources.read(path, "icon");

    if ("problem" in read) {
      this.#problem(attribute, read.message);
    } else if (!(await this.#renders.isRenderOf(read.file.sha1, this.#node.id))) {
      this.#problem(
        attribute,
        `${path} would redraw the icon: an icon's SVG makes new vector layers, so delete the icon and create it again from the file.`,
      );
    }
  }

  #isPlanned(path: string): boolean {
    return this.#planned.has(unnumbered(path));
  }

  #problem(attribute: string, message: string): void {
    this.problems.push({
      attribute,
      message,
    });
  }
}

/** A planned path without the -2, -3… design_read adds to a file name taken earlier in the same read. */
function unnumbered(path: string): string {
  return path.replace(/-\d+(\.[^./\\]+)$/, "$1");
}

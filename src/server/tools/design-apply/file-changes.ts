import { InjectionToken, inject, injectable } from "@needle-di/core";
import { APPLY_TAG, ATTRIBUTE } from "@/core/apply/apply.constants.ts";
import type { Assessment, FileChange } from "@/core/apply/plan/plan.types.ts";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { PAINT_WRITE } from "@/core/css/groups/paint/paint.constants.ts";
import { CSS_SPLIT } from "@/core/css/values/css-split.ts";
import { CSS_URL } from "@/core/css/values/css-url.ts";
import { CSS_SEPARATOR } from "@/core/css/values/values.constants.ts";
import { WRITTEN_FILES } from "@/server/app/stores/written-files.ts";
import {
  SOURCE_KIND,
  SOURCE_PROBLEM,
  SOURCE_TEXT,
  SOURCE_VALUE,
} from "@/server/tools/design-apply/design-apply.constants.ts";
import { SOURCE_FILES, type SourceKind, type SourceReads } from "@/server/tools/design-apply/source-files.ts";

/** One layer against the files its element names: what it holds and what was found. */
interface LayerFiles {
  readonly id: string;
  /** The paths design_read plans for the layer, rendered alone in its parent: none of them numbered. */
  readonly planned: ReadonlySet<string>;
  /** The hashes of the layer's own images: a file of the same bytes is the same image. */
  readonly hashes: ReadonlySet<string>;
  readonly reads: SourceReads;
  readonly renders: () => ReadonlyMap<string, readonly string[]>;
  readonly problems: { attribute: string; message: string }[];
}

/**
 * What the files each compared element names change (T-132, T-133): the attributes whose file holds another image than
 * the layer's (an Image's src, a background's url()s), and why a file cannot be used. A file is the same image when its
 * bytes are the layer's (their SHA-1 is Figma's image hash) or a file design_read or assets_export wrote for this layer,
 * wherever it went; one that is not there is fine only as the path design_read plans for it. An Icon's drawing is never
 * replaced: its src may only name a render of it, or its planned path while nothing is there.
 */
@injectable()
export class FileChanges {
  readonly #sources;
  readonly #written;
  readonly #split;
  readonly #urls;

  constructor(
    sources = inject(SOURCE_FILES),
    written = inject(WRITTEN_FILES),
    split = inject(CSS_SPLIT),
    urls = inject(CSS_URL),
  ) {
    this.#sources = sources;
    this.#written = written;
    this.#split = split;
    this.#urls = urls;
  }

  async of(assessed: readonly Assessment[], reads: SourceReads = new Map()): Promise<Map<string, FileChange>> {
    const changes = new Map<string, FileChange>();
    let known: ReadonlyMap<string, readonly string[]> | null = null;
    // The written files are read at most once a call, and only when a file is there to compare.
    const renders = () => (known ??= this.#written.read());

    for (const { element, entry, now } of assessed) {
      const { src, background } = element.attributes;

      if (entry !== undefined && now !== undefined && (src !== undefined || background !== undefined)) {
        const fills = Array.isArray(entry.layer.fills) ? entry.layer.fills : [];
        const layer: LayerFiles = {
          id: entry.layer.id,
          planned: new Set([
            ...(now.current.src === undefined ? [] : [now.current.src]),
            ...this.#files(now.current.background),
          ]),
          hashes: new Set(fills.flatMap(({ imageHash }) => (typeof imageHash === "string" ? [imageHash] : []))),
          reads,
          renders,
          problems: [],
        };

        changes.set(element.ref, { changed: await this.#changed(element, layer), problems: layer.problems });
      }
    }

    return changes;
  }

  async #changed(element: Assessment["element"], layer: LayerFiles): Promise<string[]> {
    const changed: string[] = [];
    const { src, background } = element.attributes;

    if (element.tag === APPLY_TAG.image && src !== undefined && (await this.#differs(layer, ATTRIBUTE.src, src))) {
      changed.push(ATTRIBUTE.src);
    }

    if (element.tag === APPLY_TAG.icon && src !== undefined) {
      await this.#checkDrawing(layer, src);
    }

    for (const path of this.#files(background)) {
      if (await this.#differs(layer, CSS_PROPERTY.background, path)) {
        changed.push(CSS_PROPERTY.background);
        break;
      }
    }

    return changed;
  }

  /** Whether the file at this path holds another image than the layer's; one that cannot be used is a problem. */
  async #differs(
    layer: LayerFiles,
    attribute: string,
    path: string,
  ): Promise<boolean> {
    const read = await this.#read(layer, attribute, path, SOURCE_KIND.image);

    return read !== null && !layer.hashes.has(read) && !this.#isRender(layer, read);
  }

  /** An Icon's file: a render of it, or its planned path with nothing there (a file there may hold another drawing). */
  async #checkDrawing(layer: LayerFiles, path: string): Promise<void> {
    const read = await this.#read(layer, ATTRIBUTE.src, path, SOURCE_KIND.icon);

    if (read !== null && !this.#isRender(layer, read)) {
      layer.problems.push({ attribute: ATTRIBUTE.src, message: SOURCE_TEXT.redraw(path) });
    }
  }

  /** The file's SHA-1; null when there is none to use, a problem unless it is a planned path not written. */
  async #read(
    layer: LayerFiles,
    attribute: string,
    path: string,
    kind: SourceKind,
  ): Promise<string | null> {
    const read = await this.#sources.read(path, kind, layer.reads);

    if (read.file !== undefined) {
      return read.file.sha1;
    }

    if (read.problem === SOURCE_PROBLEM.unusable || !this.#isPlanned(layer, path)) {
      layer.problems.push({ attribute, message: read.message });
    }

    return null;
  }

  #isRender(layer: LayerFiles, sha1: string): boolean {
    return (layer.renders().get(sha1) ?? []).includes(layer.id);
  }

  /**
   * The path planned for the layer, or it with the number a whole read adds to a name taken earlier in it (m:28fe3c6d):
   * only the given path loses its last -N, so "Vector 3"'s vector-3.svg never meets "Vector 7"'s vector-7.svg.
   */
  #isPlanned(layer: LayerFiles, path: string): boolean {
    return layer.planned.has(path) || layer.planned.has(path.replace(SOURCE_VALUE.numbered, SOURCE_VALUE.unnumbered));
  }

  /** The files a background's url() layers name. */
  #files(background: string | undefined): string[] {
    return this.#split.split(background ?? "", CSS_SEPARATOR.comma).flatMap((layer) => {
      const image = this.#urls.image(layer);

      return image === null || PAINT_WRITE.error in image ? [] : [image.src];
    });
  }
}

export const FILE_CHANGES = new InjectionToken<FileChanges>("FileChanges");

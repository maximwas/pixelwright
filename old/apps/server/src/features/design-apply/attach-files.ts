import type { ApplyChange, ApplyError, PaintSpec } from "@pixelwright/core";
import { imageInfo } from "../../assets/image-info.ts";
import type { PluginSession } from "../../plugin/plugin-session.ts";
import { MAX_FIGMA_IMAGE_SIDE } from "./constants.ts";
import type { SourceFile, SourceFiles, SourceKind } from "./source-files.ts";
import { uploadFile } from "./upload.ts";

type Props = ApplyChange["props"];

/** A file held for the changes: why it cannot be used, or the file and, for an image sent, its stream. */
type Held = { readonly error: string } | { readonly file: SourceFile; readonly stream?: string };

/** How files go to the plugin: not at all on a dry run, else in chunks of this many bytes. */
export interface AttachOptions {
  readonly dryRun: boolean;
  readonly chunkBytes: number;
}

/**
 * Each file the changes name, held once per kind and path: an Icon's SVG goes on its change, an image's bytes to the
 * plugin in chunks (not on a dry run), its stream named where it is used. A file that cannot be used is an error on
 * its attribute; an Image or Icon made from nothing is not made without its file.
 */
export class FileAttacher {
  readonly #session: PluginSession;
  readonly #sources: SourceFiles;
  readonly #options: AttachOptions;
  readonly #held = new Map<string, Promise<Held>>();
  readonly #errors: ApplyError[] = [];

  constructor(session: PluginSession, sources: SourceFiles, options: AttachOptions) {
    this.#session = session;
    this.#sources = sources;
    this.#options = options;
  }

  async attach(changes: readonly ApplyChange[]): Promise<{ changes: ApplyChange[]; errors: ApplyError[] }> {
    const kept: ApplyChange[] = [];

    for (const change of changes) {
      const props = await this.#asset(change);

      if (props !== null) {
        kept.push({
          ...change,
          props: await this.#fills(change, props),
        });
      }
    }

    return {
      changes: kept,
      errors: this.#errors,
    };
  }

  /** The props with the asset's file on them; without the asset when it cannot be used, null when the change goes. */
  async #asset(change: ApplyChange): Promise<Props | null> {
    const asset = change.props.asset;

    if (asset === undefined) {
      return change.props;
    }

    const held = await this.#hold(asset.src, asset.kind);

    if ("error" in held) {
      this.#fail(change, change.sources.asset ?? "src", held.error);

      return change.kind === "create" && change.copyOf === undefined ? null : without(change.props, "asset");
    }

    return {
      ...change.props,
      asset: {
        ...asset,
        ...(held.stream === undefined ? {} : { stream: held.stream }),
        ...(asset.kind === "icon" ? { svg: held.file.bytes.toString("utf8") } : {}),
      },
    };
  }

  /** The props with each image paint's stream; without fills when a file of theirs cannot be used. */
  async #fills(change: ApplyChange, props: Props): Promise<Props> {
    const paints = props.fills;

    if (paints === undefined || !paints.some((paint) => paint.kind === "image")) {
      return props;
    }

    const fills: PaintSpec[] = [];

    for (const paint of paints) {
      const held = paint.kind === "image" ? await this.#hold(paint.src, "image") : null;

      if (held !== null && "error" in held) {
        this.#fail(change, change.sources.fills ?? "background", held.error);

        return without(props, "fills");
      }

      fills.push(
        paint.kind === "image" && held?.stream !== undefined
          ? {
              ...paint,
              stream: held.stream,
            }
          : paint,
      );
    }

    return {
      ...props,
      fills,
    };
  }

  #hold(path: string, kind: SourceKind): Promise<Held> {
    const key = `${kind} ${path}`;
    let held = this.#held.get(key);

    if (held === undefined) {
      held = this.#holdFile(path, kind);
      this.#held.set(key, held);
    }

    return held;
  }

  async #holdFile(path: string, kind: SourceKind): Promise<Held> {
    const read = await this.#sources.read(path, kind);

    if ("problem" in read) {
      return { error: read.message };
    }

    const refused = kind === "image" ? imageRefusal(path, read.file.bytes) : null;

    if (refused !== null) {
      return { error: refused };
    }

    if (kind === "icon" || this.#options.dryRun) {
      return { file: read.file };
    }

    return {
      file: read.file,
      stream: await uploadFile(this.#session, read.file.bytes, this.#options.chunkBytes),
    };
  }

  #fail(change: ApplyChange, attribute: string, message: string): void {
    this.#errors.push({
      line: change.line,
      column: change.column,
      ...(change.id === null ? {} : { id: change.id }),
      attribute,
      message,
    });
  }
}

/** Why Figma cannot make an image of these bytes: WebP, or a side past what createImage takes. */
function imageRefusal(path: string, bytes: Buffer): string | null {
  const info = imageInfo(bytes);

  if (info?.format === "webp") {
    return `${path} is a WebP image: Figma makes images of PNG, JPG and GIF files only, so convert it first.`;
  }

  if (info !== null && Math.max(info.width, info.height) > MAX_FIGMA_IMAGE_SIDE) {
    return `${path} is ${info.width}×${info.height} px: Figma takes images up to ${MAX_FIGMA_IMAGE_SIDE} px a side, so scale it down first.`;
  }

  return null;
}

function without<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const { [key]: _left, ...rest } = value;

  return rest;
}

import { InjectionToken, inject, injectable } from "@needle-di/core";
import { omit } from "es-toolkit";
import { ATTRIBUTE, CHANGE_KIND } from "@/core/apply/apply.constants.ts";
import type { ApplyChange, ApplyError } from "@/core/apply/apply.types.ts";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { UPLOAD_PUSH } from "@/server/app/renders/upload-push.ts";
import type { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import {
  SOURCE_FORMAT,
  SOURCE_KIND,
  SOURCE_LIMIT,
  SOURCE_TEXT,
  SOURCE_VALUE,
} from "@/server/tools/design-apply/design-apply.constants.ts";
import {
  SOURCE_FILES,
  type SourceFile,
  type SourceKind,
  type SourceReads,
} from "@/server/tools/design-apply/source-files.ts";
import { INTENT_KEY, INTENT_PAINT } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type PaintSpec = NonNullable<FigmaProps["fills"]>[number];

/** A file held for the changes: why it cannot be used, or the file and, for an image sent, its stream. */
type Held =
  | { readonly error: string; readonly file?: undefined }
  | { readonly error?: undefined; readonly file: SourceFile; readonly stream?: string };

/** How one call sends its files: not at all on a dry run, and the reads the plan made already. */
export interface AttachCall {
  readonly session: PluginSession;
  readonly dry: boolean;
  readonly reads: SourceReads;
}

/** What one attach is working through: the call, the files held so far, the errors. */
interface Attaching extends AttachCall {
  readonly held: Map<string, Promise<Held>>;
  readonly errors: ApplyError[];
}

/** The changes with their files on them, and the files that could not be used. */
export interface Attached {
  readonly changes: ApplyChange[];
  readonly errors: ApplyError[];
}

/**
 * Each file the changes name, held once per kind and path (T-131): an Icon's SVG goes on its change, an image's bytes
 * to the plugin in chunks (not on a dry run), its stream named where it is used. A file that cannot be used (a WebP, a
 * side past 4096 px) is an error on its attribute; an Image or Icon made from nothing is not made without its file.
 */
@injectable()
export class FileAttach {
  readonly #sources;
  readonly #push;

  constructor(sources = inject(SOURCE_FILES), push = inject(UPLOAD_PUSH)) {
    this.#sources = sources;
    this.#push = push;
  }

  async attach(changes: readonly ApplyChange[], call: AttachCall): Promise<Attached> {
    const attaching: Attaching = { ...call, held: new Map(), errors: [] };
    const kept: ApplyChange[] = [];

    for (const change of changes) {
      const props = await this.#asset(change, attaching);

      if (props !== null) {
        kept.push({ ...change, props: await this.#fills(change, props, attaching) });
      }
    }

    return { changes: kept, errors: attaching.errors };
  }

  /** The props with the asset's file on them; without the asset when it cannot be used, null when the change goes. */
  async #asset(change: ApplyChange, call: Attaching): Promise<FigmaProps | null> {
    const asset = change.props.asset;

    if (asset === undefined) {
      return change.props;
    }

    const held = await this.#hold(asset.src, asset.kind, call);

    if (held.error !== undefined) {
      this.#fail(change, change.sources.asset ?? ATTRIBUTE.src, held.error, call);

      return change.kind === CHANGE_KIND.create && change.copyOf === undefined
        ? null
        : omit(change.props, [INTENT_KEY.asset]);
    }

    return {
      ...change.props,
      asset: {
        ...asset,
        ...(held.stream === undefined ? {} : { stream: held.stream }),
        ...(asset.kind === SOURCE_KIND.icon ? { svg: held.file.bytes.toString(SOURCE_VALUE.utf8) } : {}),
      },
    };
  }

  /** The props with each image paint's stream; without fills when a file of theirs cannot be used. */
  async #fills(
    change: ApplyChange,
    props: FigmaProps,
    call: Attaching,
  ): Promise<FigmaProps> {
    const paints = props.fills;

    if (paints === undefined || !paints.some((paint) => paint.kind === INTENT_PAINT.image)) {
      return props;
    }

    const fills: PaintSpec[] = [];

    for (const paint of paints) {
      const held =
        paint.kind === INTENT_PAINT.image ? await this.#hold(paint.src ?? "", SOURCE_KIND.image, call) : null;

      if (held?.error !== undefined) {
        this.#fail(change, change.sources.fills ?? CSS_PROPERTY.background, held.error, call);

        return omit(props, [INTENT_KEY.fills]);
      }

      fills.push(held?.stream === undefined ? paint : { ...paint, stream: held.stream });
    }

    return { ...props, fills };
  }

  #hold(
    path: string,
    kind: SourceKind,
    call: Attaching,
  ): Promise<Held> {
    const key = SOURCE_TEXT.key(kind, path);
    let held = call.held.get(key);

    if (held === undefined) {
      held = this.#holdFile(path, kind, call);
      call.held.set(key, held);
    }

    return held;
  }

  async #holdFile(
    path: string,
    kind: SourceKind,
    call: Attaching,
  ): Promise<Held> {
    const read = await this.#sources.read(path, kind, call.reads);

    if (read.file === undefined) {
      return { error: read.message };
    }

    const refused = kind === SOURCE_KIND.image ? this.#refusal(path, read.file) : null;

    if (refused !== null) {
      return { error: refused };
    }

    if (kind === SOURCE_KIND.icon || call.dry) {
      return { file: read.file };
    }

    return { file: read.file, stream: await this.#push.push(call.session, read.file.bytes) };
  }

  /** Why Figma cannot make an image of the file (FX-055): WebP, or a side past what createImage takes. */
  #refusal(path: string, { image }: SourceFile): string | null {
    if (image !== null && !SOURCE_FORMAT.figma.some((format) => format === image.format)) {
      return SOURCE_TEXT.webp(path);
    }

    if (image !== null && Math.max(image.width, image.height) > SOURCE_LIMIT.imageSide) {
      return SOURCE_TEXT.tooWide(path, image.width, image.height);
    }

    return null;
  }

  #fail(
    change: ApplyChange,
    attribute: string,
    message: string,
    call: Attaching,
  ): void {
    call.errors.push({
      line: change.line,
      column: change.column,
      ...(change.id === null ? {} : { id: change.id }),
      attribute,
      message,
    });
  }
}

export const FILE_ATTACH = new InjectionToken<FileAttach>("FileAttach");

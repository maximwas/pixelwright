import { randomUUID } from "node:crypto";
import {
  type ApplyChange,
  type ApplyElement,
  type ApplyError,
  type Assessment,
  assessElements,
  CurrentLayers,
  changesToSend,
  type FileChanges,
  layersToRead,
  type PaintSpec,
  planChanges,
  readApply,
  type SnapshotNode,
  sortedErrors,
  urlsOf,
} from "@pixelwright/core";
import type * as z from "zod";
import { imageInfo } from "../assets/image-info.ts";
import { readSource, type SourceFile } from "../assets/read-source.ts";
import { memoryFiles, type WrittenFiles } from "../assets/written-files.ts";
import { MAX_FIGMA_IMAGE_SIDE, UPLOAD_CHUNK_BYTES } from "../constants/mcp.ts";
import { versionBefore } from "../history/version-before.ts";
import { PluginClient } from "../plugin/plugin-client.ts";
import type { DesignApplyInputSchema, DesignApplyOutputSchema } from "../schemas/tools.ts";
import type { ToolContext } from "../types/mcp.ts";

type DesignApplyArgs = z.output<typeof DesignApplyInputSchema>;
type DesignApplied = z.input<typeof DesignApplyOutputSchema>;

/**
 * readApply, then the layers' entries from the plugin so what they already have is left out, then the changes in
 * Figma's terms with their files attached, in one apply: all on the one file the call targets.
 */
export async function applyDesign(
  bridge: ToolContext["bridge"],
  { xml, parent, dryRun, file, version: title }: DesignApplyArgs,
  {
    cwd = process.cwd(),
    chunkBytes = UPLOAD_CHUNK_BYTES,
    files = memoryFiles(),
  }: { cwd?: string; chunkBytes?: number; files?: WrittenFiles } = {},
): Promise<DesignApplied> {
  const read = readApply(xml);
  const nothing = {
    created: [],
    changed: [],
    dryRun,
  };

  if (read.elements.length === 0) {
    return {
      ...nothing,
      errors: read.errors,
    };
  }

  // Every operation of the call goes to this one file, whatever file comes to the front meanwhile.
  const session = new PluginClient(bridge).session(file);
  const ids = layersToRead(read.elements);
  const layers = ids.length === 0 ? CurrentLayers.none() : CurrentLayers.of(await session.run("entries", { ids }));
  const { assessed, errors: refused } = assessElements(read.elements, layers);
  const planned = planChanges({
    elements: read.elements,
    assessed,
    layers,
    files: await fileChangesOf(assessed, {
      cwd,
      files,
    }),
  });
  const attached = await attachFiles(planned.changes, {
    cwd,
    dryRun,
    chunkBytes,
    send: (input) => session.run("upload", input),
  });
  const errors = [...read.errors, ...refused, ...planned.errors, ...attached.errors];
  const sent = changesToSend(attached.changes);

  if (sent.length === 0) {
    return {
      ...nothing,
      errors: sortedErrors(errors),
    };
  }

  const version = await versionBefore(session, {
    title,
    dryRun,
  });
  const applied = await session.run("apply", {
    changes: sent,
    ...(parent === undefined ? {} : { parent }),
    dryRun,
  });

  return {
    created: applied.created,
    changed: applied.changed,
    errors: sortedErrors([...errors, ...applied.errors]),
    dryRun,
    ...(version === undefined ? {} : { version }),
  };
}

/** What the files each compared element names change, by ref; the store of written files is read once, if at all. */
async function fileChangesOf(
  assessed: readonly Assessment[],
  { cwd, files }: { cwd: string; files: WrittenFiles },
): Promise<Map<string, FileChanges>> {
  let known: Promise<ReadonlyMap<string, readonly string[]>> | null = null;
  const written = () => {
    known ??= files.read();

    return known;
  };
  const changes = new Map<string, FileChanges>();

  for (const { element, entry, now } of assessed) {
    if (entry !== undefined && now !== undefined) {
      changes.set(
        element.ref,
        await filesChanged(element, entry.node, now.current, {
          cwd,
          written,
        }),
      );
    }
  }

  return changes;
}

/**
 * What the files an element names change: the attributes whose file holds another image than the layer's, and why a
 * file cannot be used. A file design_read or assets_export wrote for this layer (a render of it, not the image inside)
 * changes nothing wherever it went; a file that is not there is fine only as the path design_read writes, which it
 * plans without writing when no assetsDir is given.
 */
async function filesChanged(
  element: ApplyElement,
  node: SnapshotNode,
  current: Readonly<Record<string, string>>,
  { cwd, written }: { cwd: string; written: () => Promise<ReadonlyMap<string, readonly string[]>> },
): Promise<FileChanges> {
  const planned = new Set([current.src, ...urlsOf(current.background ?? "")]);
  const hashes = new Set(
    (Array.isArray(node.fills) ? node.fills : []).flatMap((paint) =>
      paint.imageHash === undefined ? [] : [paint.imageHash],
    ),
  );
  const changed: string[] = [];
  const problems: { attribute: string; message: string }[] = [];
  const differs = async (attribute: string, path: string) => {
    const file = await readSource(path, cwd, "image");

    if (file === null || typeof file === "string") {
      if (file !== null || !planned.has(path)) {
        problems.push({
          attribute,
          message: file ?? `${path} is not a file the server can read (paths are from its folder: ${cwd}).`,
        });
      }

      return false;
    }

    return !hashes.has(file.sha1) && !((await written()).get(file.sha1) ?? []).includes(node.id);
  };
  const src = element.attributes.src;

  if (element.tag === "Image" && src !== undefined && (await differs("src", src))) {
    changed.push("src");
  }

  for (const path of urlsOf(element.attributes.background ?? "")) {
    if (await differs("background", path)) {
      changed.push("background");
      break;
    }
  }

  return {
    changed,
    problems,
  };
}

/**
 * Each file the changes name, read once: an Icon's SVG goes on its change, an image's bytes to the plugin in chunks
 * (not on a dry run), its stream named where it is used. A file that cannot be used is an error on its attribute; an
 * Image or Icon without its file is not made.
 */
async function attachFiles(
  changes: readonly ApplyChange[],
  options: {
    cwd: string;
    dryRun: boolean;
    chunkBytes: number;
    send: (input: { stream: string; offset: number; chunk: string; total: number }) => Promise<unknown>;
  },
): Promise<{ changes: ApplyChange[]; errors: ApplyError[] }> {
  const held = new Map<string, Promise<Held>>();
  const errors: ApplyError[] = [];
  const hold = (path: string, kind: "image" | "icon") => {
    const key = `${kind} ${path}`;
    let file = held.get(key);

    if (file === undefined) {
      file = holdFile(path, kind, options);
      held.set(key, file);
    }

    return file;
  };
  const kept: ApplyChange[] = [];

  for (const change of changes) {
    const fail = (attribute: string, message: string) =>
      errors.push({
        line: change.line,
        column: change.column,
        ...(change.id === null ? {} : { id: change.id }),
        attribute,
        message,
      });
    let props = change.props;
    const asset = props.asset;

    if (asset !== undefined) {
      const file = await hold(asset.src, asset.kind);

      if ("error" in file) {
        fail(change.sources.asset ?? "src", file.error);
        props = without(props, "asset");

        if (change.kind === "create" && change.copyOf === undefined) {
          continue;
        }
      } else {
        props = {
          ...props,
          asset: {
            ...asset,
            ...(file.stream === undefined ? {} : { stream: file.stream }),
            ...(asset.kind === "icon" ? { svg: file.file.bytes.toString("utf8") } : {}),
          },
        };
      }
    }

    if (props.fills?.some((paint) => paint.kind === "image")) {
      const fills: PaintSpec[] = [];
      let broken = false;

      for (const paint of props.fills) {
        const file = paint.kind === "image" ? await hold(paint.src, "image") : null;

        if (file !== null && "error" in file) {
          fail(change.sources.fills ?? "background", file.error);
          broken = true;
          break;
        }

        fills.push(
          paint.kind === "image" && file?.stream !== undefined
            ? {
                ...paint,
                stream: file.stream,
              }
            : paint,
        );
      }

      props = broken
        ? without(props, "fills")
        : {
            ...props,
            fills,
          };
    }

    kept.push({
      ...change,
      props,
    });
  }

  return {
    changes: kept,
    errors,
  };
}

/** A file read for the changes: why it cannot be used, or the file and, for an image sent, its stream. */
type Held = { readonly error: string } | { readonly file: SourceFile; readonly stream?: string };

async function holdFile(
  path: string,
  kind: "image" | "icon",
  options: Parameters<typeof attachFiles>[1],
): Promise<Held> {
  const file = await readSource(path, options.cwd, kind);

  if (file === null) {
    return { error: `${path} is not a file the server can read (paths are from its folder: ${options.cwd}).` };
  }

  if (typeof file === "string") {
    return { error: file };
  }

  const info = kind === "image" ? imageInfo(file.bytes) : null;

  if (info?.format === "webp") {
    return {
      error: `${path} is a WebP image: Figma makes images of PNG, JPG and GIF files only, so convert it first.`,
    };
  }

  if (info !== null && Math.max(info.width, info.height) > MAX_FIGMA_IMAGE_SIDE) {
    return {
      error: `${path} is ${info.width}×${info.height} px: Figma takes images up to ${MAX_FIGMA_IMAGE_SIDE} px a side, so scale it down first.`,
    };
  }

  if (kind === "icon" || options.dryRun) {
    return { file };
  }

  const stream = randomUUID();

  for (let offset = 0; offset < file.bytes.length; offset += options.chunkBytes) {
    await options.send({
      stream,
      offset,
      chunk: file.bytes.subarray(offset, offset + options.chunkBytes).toString("base64"),
      total: file.bytes.length,
    });
  }

  return {
    file,
    stream,
  };
}

function without<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const { [key]: _left, ...rest } = value;

  return rest;
}

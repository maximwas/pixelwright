import { randomUUID } from "node:crypto";
import {
  type ApplyChange,
  type ApplyElement,
  type ApplyError,
  changeOf,
  OPERATION_SCHEMAS,
  type PaintSpec,
  readApply,
  type SnapshotNode,
  unchangedAttributes,
  urlsOf,
} from "@pixelwright/core";
import type * as z from "zod";
import { imageInfo } from "../assets/image-info.ts";
import { readSource, type SourceFile } from "../assets/read-source.ts";
import { memoryFiles, type WrittenFiles } from "../assets/written-files.ts";
import { resolveTarget } from "../bridge/target.ts";
import { MAX_FIGMA_IMAGE_SIDE, UPLOAD_CHUNK_BYTES } from "../constants/mcp.ts";
import { versionBefore } from "../history/version-before.ts";
import type { DesignApplyInputSchema, DesignApplyOutputSchema } from "../schemas/tools.ts";
import type { ToolContext } from "../types/mcp.ts";

type DesignApplyArgs = z.output<typeof DesignApplyInputSchema>;
/** A layer as the plugin read it, with its parent. */
type Layer = { node: SnapshotNode; parent: SnapshotNode | null };
type DesignApplied = z.input<typeof DesignApplyOutputSchema>;

/**
 * readApply, then the layers' entries from the plugin so what they already have is left out (unchangedAttributes),
 * then the changes in Figma's terms (changeOf) in one apply: all on the one file the call targets.
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
  const errors: ApplyError[] = [...read.errors];
  const nothing = {
    created: [],
    changed: [],
    dryRun,
  };

  if (read.elements.length === 0) {
    return {
      ...nothing,
      errors,
    };
  }

  const target = resolveTarget(bridge.plugins(), file);
  const byRef = new Map(read.elements.map((element) => [element.ref, element]));
  // Inside a new instance the layers are the component's at their defaults, whatever the instance named has: all its
  // element gives is written. Inside a copy they start as the copied ones.
  const compared = (element: ApplyElement) =>
    element.copy === undefined || byRef.get(element.copy)?.attributes.copyOf !== undefined ? element.source : undefined;
  // The layers changed, and the sources copies are made of (a copy starts as its source).
  const ids = [
    ...new Set(
      read.elements.flatMap((element) =>
        [element.id, compared(element), element.attributes.copyOf].filter(
          (id): id is string => id !== undefined && id !== null,
        ),
      ),
    ),
  ];
  const layers = new Map<string, Layer>();
  const missing = new Set<string>();
  const tokens = {
    styles: {},
    variables: {},
  };

  if (ids.length > 0) {
    const entries = OPERATION_SCHEMAS.entries.output.parse(await bridge.request("entries", { ids }, target));

    tokens.styles = entries.styles;
    tokens.variables = entries.variables;

    for (const root of entries.roots) {
      index(root.node, root.parent, layers);
    }

    for (const id of entries.missing) {
      missing.add(id);
    }
  }

  const changes: ApplyChange[] = [];
  // Read once, and only when an element names a file.
  let known: Promise<ReadonlyMap<string, readonly string[]>> | null = null;
  const written = () => {
    known ??= files.read();

    return known;
  };
  const refuse = (element: ApplyElement, message: string, hint: string) =>
    errors.push({
      line: element.line,
      column: element.column,
      ...(element.id === null ? {} : { id: element.id }),
      message,
      hint,
    });

  for (const element of read.elements) {
    const named = element.id ?? compared(element) ?? element.attributes.copyOf ?? null;
    const layer = named === null ? undefined : layers.get(named);

    if (named !== null && layer === undefined && !missing.has(named) && element.attributes.copyOf === undefined) {
      // Past the read's size budget: unknown, so every attribute would be written again, rounded.
      refuse(
        element,
        `design_apply could not read ${named}'s current state: the call holds too many layers at once.`,
        "Send fewer layers in one call, or this one on its own.",
      );
      continue;
    }

    const now = layer === undefined ? undefined : unchangedAttributes(element, layer, tokens);
    // A file the layer's image is not: written again (src, a background's url).
    const differ =
      layer === undefined || now === undefined
        ? {
            changed: [],
            errors: [],
          }
        : await filesChanged(element, layer.node, now.current, {
            cwd,
            written,
          });
    const { change, errors: translated } = changeOf(
      element,
      now === undefined
        ? undefined
        : {
            ...now,
            attributes: new Set([...now.attributes].filter((name) => !differ.changed.includes(name))),
          },
    );

    changes.push(change);
    errors.push(
      ...translated,
      ...differ.errors.map(({ attribute, message }) => ({
        line: element.line,
        column: element.column,
        ...(element.id === null ? {} : { id: element.id }),
        attribute,
        message,
      })),
    );
  }

  const moving = moves(read.elements, layers);

  const attached = await attachFiles(
    changes.map((change) =>
      moving.has(change.ref)
        ? {
            ...change,
            move: true,
          }
        : change,
    ),
    {
      cwd,
      dryRun,
      chunkBytes,
      send: (input) => bridge.request("upload", input, target),
    },
  );

  errors.push(...attached.errors);

  // What writes nothing stays here. A layer made or moved goes with its parent and the elements beside it, unchanged,
  // so the plugin finds where it goes.
  const placed = attached.changes.filter((change) => change.kind === "create" || (change.move ?? false));
  const parents = new Set(placed.flatMap((change) => (change.parent === null ? [] : [change.parent])));
  const beside = new Set(placed.map((change) => change.parent ?? ""));
  const sent = attached.changes.filter(
    (change) =>
      change.kind === "create" ||
      (change.move ?? false) ||
      change.text !== undefined ||
      Object.keys(change.props).length > 0 ||
      parents.has(change.ref) ||
      beside.has(change.parent ?? ""),
  );

  if (sent.length === 0) {
    return {
      ...nothing,
      errors: sorted(errors),
    };
  }

  const version = await versionBefore(bridge, {
    title,
    dryRun,
    file,
  });
  const applied = OPERATION_SCHEMAS.apply.output.parse(
    await bridge.request(
      "apply",
      {
        changes: sent,
        ...(parent === undefined ? {} : { parent }),
        dryRun,
      },
      target,
    ),
  );

  return {
    created: applied.created,
    changed: applied.changed,
    errors: sorted([...errors, ...applied.errors]),
    dryRun,
    ...(version === undefined ? {} : { version }),
  };
}

/**
 * Elements that move their layer, by ref: under another parent element (a new one included), with before or after, or
 * out of the order of the layers listed with it.
 */
function moves(elements: readonly ApplyElement[], layers: ReadonlyMap<string, Layer>): Set<string> {
  const byRef = new Map(elements.map((element) => [element.ref, element]));
  const found = new Set<string>();
  const last = new Map<string, number>();

  for (const element of elements) {
    const layer = element.id === null ? undefined : layers.get(element.id);

    if (layer === undefined) {
      continue;
    }

    const inside = element.parent === null ? undefined : byRef.get(element.parent);
    const parent = layer.parent?.id ?? null;

    if (element.attributes.before !== undefined || element.attributes.after !== undefined) {
      found.add(element.ref);
    } else if (inside !== undefined && inside.id !== parent) {
      found.add(element.ref);
    } else if (inside !== undefined && parent !== null) {
      const at = (layers.get(parent)?.node.children ?? []).findIndex((child) => child.id === element.id);
      const before = last.get(parent) ?? -1;

      if (at !== -1 && at < before) {
        found.add(element.ref);
      }

      last.set(parent, Math.max(before, at));
    }
  }

  return found;
}

function index(node: SnapshotNode, parent: SnapshotNode | null, layers: Map<string, Layer>): void {
  layers.set(node.id, {
    node,
    parent,
  });

  for (const child of node.children ?? []) {
    index(child, node, layers);
  }
}

function sorted(errors: readonly ApplyError[]): ApplyError[] {
  return errors.toSorted((a, b) => a.line - b.line || a.column - b.column);
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
): Promise<{ changed: string[]; errors: { attribute: string; message: string }[] }> {
  const planned = new Set([current.src, ...urlsOf(current.background ?? "")]);
  const hashes = new Set(
    (Array.isArray(node.fills) ? node.fills : []).flatMap((paint) =>
      paint.imageHash === undefined ? [] : [paint.imageHash],
    ),
  );
  const changed: string[] = [];
  const errors: { attribute: string; message: string }[] = [];
  const differs = async (attribute: string, path: string) => {
    const file = await readSource(path, cwd, "image");

    if (file === null || typeof file === "string") {
      if (file !== null || !planned.has(path)) {
        errors.push({
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
    errors,
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

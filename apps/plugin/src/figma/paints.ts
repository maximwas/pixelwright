import type { PaintSpec } from "@pixelwright/core";
import { documentColor } from "./color-profile.ts";
import type { TokenIndex } from "./tokens/token-index.ts";
import { WriteError } from "./write-error.ts";

/** What paints are made from besides their specs: the call's token index, and the bytes an upload brought. */
export interface PaintSources {
  readonly tokens: () => Promise<TokenIndex>;
  readonly uploads?: (stream: string) => Uint8Array | undefined;
}

/** Paints as Figma takes them: one paint style alone, or layers of colours, images and colour variables. */
export async function paintsOf(
  specs: readonly PaintSpec[],
  sources: PaintSources,
): Promise<{ style: string } | { paints: Paint[] }> {
  const style = await onlyStyle(specs, () => sources.tokens());

  if (style !== null) {
    return { style };
  }

  const paints: Paint[] = [];

  for (const spec of specs) {
    paints.push(await paintOf(spec, sources));
  }

  return { paints };
}

/**
 * Why paints cannot be written, found without importing anything (a dry run): the rule paintsOf follows. A paint
 * style is the whole list alone, at full opacity; every other token is a colour variable.
 */
export async function checkPaints(specs: readonly PaintSpec[], index: TokenIndex): Promise<void> {
  if ((await onlyStyle(specs, index)) !== null) {
    return;
  }

  for (const spec of specs) {
    if (spec.kind === "token") {
      await refusePaintStyle(spec.token, index);
      await index.find(spec.token, "COLOR");
    }
  }
}

/** The paint style a single token at full opacity names, if it names one rather than a colour variable. */
async function onlyStyle(
  specs: readonly PaintSpec[],
  index: TokenIndex | (() => Promise<TokenIndex>),
): Promise<string | null> {
  const [only] = specs;

  if (specs.length !== 1 || only?.kind !== "token" || only.opacity !== 1) {
    return null;
  }

  return await (typeof index === "function" ? await index() : index).style(only.token, "PAINT");
}

/** A paint style is the whole list of a layer's paints: no layer of one. */
async function refusePaintStyle(token: string, index: TokenIndex): Promise<void> {
  if ((await index.style(token, "PAINT")) !== null) {
    throw new WriteError(
      `${token} is a paint style, which is the whole list of a layer's paints.`,
      "Use it as the only layer, without color-mix().",
    );
  }
}

async function paintOf(spec: PaintSpec, sources: PaintSources): Promise<Paint> {
  if (spec.kind === "color") {
    const { r, g, b, a } = documentColor(spec.color);

    return {
      type: "SOLID",
      color: {
        r,
        g,
        b,
      },
      opacity: a,
    };
  }

  if (spec.kind === "image") {
    return imagePaint(spec, sources);
  }

  return await variablePaint(spec, await sources.tokens());
}

/** A colour variable's paint: a paint style is the whole list of a layer's paints, so it is no layer of one. */
async function variablePaint(spec: Extract<PaintSpec, { kind: "token" }>, index: TokenIndex): Promise<Paint> {
  await refusePaintStyle(spec.token, index);

  return figma.variables.setBoundVariableForPaint(
    {
      type: "SOLID",
      color: {
        r: 0,
        g: 0,
        b: 0,
      },
      opacity: spec.opacity,
    },
    "color",
    await index.variable(spec.token, "COLOR"),
  );
}

/** An image layer from its uploaded file. */
export function imagePaint(spec: Extract<PaintSpec, { kind: "image" }>, sources: PaintSources): ImagePaint {
  const bytes = spec.stream === undefined ? undefined : sources.uploads?.(spec.stream);

  if (bytes === undefined) {
    throw new WriteError(`${spec.src} did not reach the plugin.`, "Give the file's path as design_read wrote it.");
  }

  return {
    type: "IMAGE",
    imageHash: figma.createImage(bytes).hash,
    scaleMode: spec.scaleMode,
  };
}

/** The parts of a paint that make it look as it does, to tell an equal one from a changed one: an image's too. */
export function paintKey(paint: Paint): string {
  const solid = paint as Partial<SolidPaint>;
  const image = paint as Partial<ImagePaint>;
  const round = (value: number | undefined) => Math.round((value ?? 0) * 10_000);

  return JSON.stringify([
    paint.type,
    paint.visible ?? true,
    round(paint.opacity ?? 1),
    solid.color === undefined ? null : [round(solid.color.r), round(solid.color.g), round(solid.color.b)],
    solid.boundVariables?.color?.id ?? null,
    image.imageHash ?? null,
    image.scaleMode ?? null,
  ]);
}

/** Whether a layer's paints already look as these do. */
export function samePaints(live: unknown, wanted: readonly Paint[]): boolean {
  return (
    Array.isArray(live) &&
    live.length === wanted.length &&
    live.every((paint: Paint, index) => paintKey(paint) === paintKey(wanted[index] as Paint))
  );
}

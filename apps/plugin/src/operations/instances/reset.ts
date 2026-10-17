import { type InstancesOutput, LOOK_OVERRIDES } from "@pixelwright/core";
import { plain } from "../../utils/plain.ts";

type Reset = InstancesOutput["reset"][number];

/** A layer's fields by name, as an override is kept and put back. */
type Fields = SceneNode & Record<string, unknown>;

/** An override the reset keeps: the layer, the field, its value before. */
interface KeptOverride {
  readonly layer: Fields;
  readonly field: string;
  readonly value: unknown;
}

/**
 * An instance's overrides taken off: all of them, or its look only. Figma keeps a field overridden even when it is
 * set back to the component's value (seen live on 2026-10-17), so a look reset takes every override off and puts the
 * others back (texts, visibility, sizes); component property values are no overrides and stay. Null when it overrides
 * nothing of the kind.
 */
export async function resetInstance(
  instance: InstanceNode,
  mode: "look" | "all",
  dryRun: boolean,
): Promise<Reset | null> {
  const fields = [
    ...new Set(
      instance.overrides.flatMap(({ overriddenFields }) =>
        overriddenFields.filter((field) => mode === "all" || LOOK_OVERRIDES[field] !== undefined),
      ),
    ),
  ] as string[];

  if (fields.length === 0) {
    return null;
  }

  if (!dryRun) {
    const kept = mode === "look" ? await keptOverrides(instance) : [];

    instance.removeOverrides();

    for (const override of kept) {
      await putBack(override);
    }
  }

  return {
    id: instance.id,
    name: instance.name,
    fields,
  };
}

/** The instance's overrides that are not of its look, with their values now. */
async function keptOverrides(instance: InstanceNode): Promise<KeptOverride[]> {
  const kept: KeptOverride[] = [];

  for (const { id, overriddenFields } of instance.overrides) {
    const layer = (await figma.getNodeByIdAsync(id)) as Fields | null;

    for (const field of layer === null ? [] : overriddenFields) {
      if (LOOK_OVERRIDES[field] === undefined && layer !== null) {
        kept.push({
          layer,
          field,
          value: plain(layer[field]),
        });
      }
    }
  }

  return kept;
}

/** An override put back: a text with its fonts loaded, a size by resize, any other field as it was. */
async function putBack({ layer, field, value }: KeptOverride): Promise<void> {
  if (field === "characters" && layer.type === "TEXT") {
    const text = layer as TextNode;
    const fonts = text.characters.length === 0 ? [text.fontName] : text.getRangeAllFontNames(0, text.characters.length);

    await Promise.all(
      fonts.filter((font): font is FontName => typeof font === "object").map((font) => figma.loadFontAsync(font)),
    );
    text.characters = String(value);
  } else if ((field === "width" || field === "height") && "resize" in layer) {
    (layer as FrameNode).resize(
      field === "width" ? Number(value) : layer.width,
      field === "height" ? Number(value) : layer.height,
    );
  } else {
    try {
      layer[field] = value;
    } catch {
      // A field Figma takes no value back for: the component's stays.
    }
  }
}

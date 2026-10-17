import { boundProperty } from "../../figma/component-properties.ts";
import { plain } from "../../utils/plain.ts";

/** What a detached frame has that its instance takes over: a text, an image, a layer hidden or shown. */
export interface Carry {
  readonly kind: "text" | "image" | "hidden" | "shown";
  readonly source: SceneNode;
  readonly target: SceneNode;
}

/** Each layer under a root by its path of names (`/Card/Title`, `/Card/Tag[2]` for a second Tag). */
function pathMap(root: SceneNode): Map<string, SceneNode> {
  const map = new Map<string, SceneNode>();
  const walk = (node: SceneNode, path: string) => {
    const counts = new Map<string, number>();

    for (const child of "children" in node ? node.children : []) {
      const count = (counts.get(child.name) ?? 0) + 1;
      const own = `${path}/${child.name}${count > 1 ? `[${count}]` : ""}`;

      counts.set(child.name, count);
      map.set(own, child);
      walk(child, own);
    }
  };

  walk(root, "");

  return map;
}

/** A layer's image fills, as a key to tell two apart; "" when it shows none. */
function imagesOf(layer: SceneNode): string {
  const fills = "fills" in layer && Array.isArray(layer.fills) ? (layer.fills as readonly Paint[]) : [];

  return fills.flatMap((paint) => (paint.type === "IMAGE" ? [paint.imageHash ?? ""] : [])).join(" ");
}

/**
 * What a detached frame's layers say that the instance's (or its component's) at the same path do not, and the frame's
 * layers the instance has no place for (the outermost of them).
 */
export function carriesOf(frame: SceneNode, model: SceneNode): { carries: Carry[]; lost: string[] } {
  const targets = pathMap(model);
  const carries: Carry[] = [];
  const lost: string[] = [];
  const lostPaths: string[] = [];

  for (const [path, source] of pathMap(frame)) {
    const target = targets.get(path);

    if (target !== undefined) {
      carries.push(...differences(source, target));
    } else if (!lostPaths.some((above) => path.startsWith(`${above}/`))) {
      lost.push(source.name);
      lostPaths.push(path);
    }
  }

  return {
    carries,
    lost,
  };
}

/** What one of the frame's layers has that the same layer of the instance does not: its text, image, visibility. */
function differences(source: SceneNode, target: SceneNode): Carry[] {
  const carries: Carry[] = [];

  if (source.type === "TEXT" && target.type === "TEXT" && source.characters !== target.characters) {
    carries.push({
      kind: "text",
      source,
      target,
    });
  }

  if (imagesOf(source) !== "" && imagesOf(source) !== imagesOf(target)) {
    carries.push({
      kind: "image",
      source,
      target,
    });
  }

  if (source.visible !== target.visible) {
    carries.push({
      kind: source.visible ? "shown" : "hidden",
      source,
      target,
    });
  }

  return carries;
}

/** A carry made on the instance: through the component property the layer shows, where it shows one. */
export async function carry({ kind, source, target }: Carry): Promise<void> {
  if (kind === "image" && "fills" in source && "fills" in target) {
    (target as GeometryMixin).fills = plain<Paint[]>(source.fills);

    return;
  }

  const field = kind === "text" ? "characters" : "visible";
  const value = kind === "text" ? (source as TextNode).characters : source.visible;
  const property = boundProperty(target, field);

  // A text changes, through its property or not, only with its fonts loaded.
  if (kind === "text" && target.type === "TEXT") {
    await loadFonts(target);
  }

  if (property !== null) {
    property.instance.setProperties({ [property.key]: value });
  } else if (kind === "text" && target.type === "TEXT") {
    target.characters = String(value);
  } else {
    target.visible = Boolean(value);
  }
}

async function loadFonts(text: TextNode): Promise<void> {
  const fonts = text.characters.length === 0 ? [text.fontName] : text.getRangeAllFontNames(0, text.characters.length);

  await Promise.all(
    fonts.filter((font): font is FontName => typeof font === "object").map((font) => figma.loadFontAsync(font)),
  );
}

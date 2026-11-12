import { InjectionToken, inject, injectable } from "@needle-di/core";
import { isEqual } from "es-toolkit";
import { ATTRIBUTE } from "@/core/apply/apply.constants.ts";
import type { ApplyElement, ContentPiece } from "@/core/apply/apply.types.ts";
import { LAYER_RENDERS, type Render } from "@/core/apply/plan/layer-renders.ts";
import { PLAN_VALUE, UNCHANGED_PATTERN, UNCHANGED_READ_AS, UNCHANGED_VALUE } from "@/core/apply/plan/plan.constants.ts";
import type { LayerEntry, LayerNow } from "@/core/apply/plan/plan.types.ts";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { FIGMA_PAINT } from "@/core/css/paints/paints.constants.ts";
import { ChangeOutput } from "@/core/css/registry/change-output.ts";
import { WRITE_REGISTRY } from "@/core/css/registry/write-registry.ts";
import { CSS_URL } from "@/core/css/values/css-url.ts";
import { COLOR_SPACE } from "@/core/kernel/color/color.constants.ts";
import { Color, type ColorSpace } from "@/core/kernel/color/color.ts";
import { XML_CONTENT } from "@/core/xml/xml.constants.ts";
import type { XmlContent } from "@/core/xml/xml.types.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** What an element's attributes are compared with: its tag, the layer's renders, the file's space, its visibility. */
interface Compared {
  readonly tag: string;
  readonly renders: readonly Render[];
  readonly space: ColorSpace;
  readonly visible: boolean;
}

/**
 * Which of an element's attributes the layer already has, judged in CSS space (D-19, C-170): the layer is rendered
 * once per call as design_read writes its element (the reader's rounding included), and an attribute is held when it
 * reads the same, or when the write half of its property group makes the same Figma properties of both (another
 * spelling of the same colour or border), or in a Display P3 file when its sRGB colours as P3 values do. A top-level
 * element is compared with the layer as the read's root and as its parent's child, since design_read writes either; a
 * nested one only as its parent holds it. A hidden layer is rendered as shown, so what it has is known when it is
 * shown again; a file's src is held (the server compares its bytes, C-149).
 */
@injectable()
export class Unchanged {
  readonly #renders;
  readonly #registry;
  readonly #urls;

  constructor(
    renders = inject(LAYER_RENDERS),
    registry = inject(WRITE_REGISTRY),
    urls = inject(CSS_URL),
  ) {
    this.#renders = renders;
    this.#registry = registry;
    this.#urls = urls;
  }

  of(element: ApplyElement, entry: LayerEntry): LayerNow {
    const { layer, parent, model } = entry;
    const nested = element.parent !== null && parent !== null;
    const parents = nested || parent === null ? [parent] : [null, parent];
    const renders = parents.map((holder) => this.#renders.attributes(entry, holder));
    const compared: Compared = {
      tag: element.tag,
      renders,
      space: model.colorProfile === FIGMA_PAINT.displayP3 ? COLOR_SPACE.displayP3 : COLOR_SPACE.srgb,
      visible: layer.visible,
    };
    const attributes = new Set(
      Object.entries(element.attributes)
        .filter(([name, given]) => this.#held(name, given, compared))
        .map(([name]) => name),
    );
    // As its parent holds it when it has one: that render places it.
    const shown = [...(renders.at(-1) ?? [])];

    return {
      attributes,
      // As design_read writes the content: the characters and every Span with its attributes in their order.
      text:
        element.content === undefined ||
        isEqual(this.#joined(this.#pieces(element.content)), this.#joined(this.#renders.content(entry))),
      visible: layer.visible,
      current: Object.fromEntries(
        shown.filter(([name]) => name !== ATTRIBUTE.id && !name.startsWith(UNCHANGED_VALUE.readOnly)),
      ),
    };
  }

  #held(
    name: string,
    given: string,
    compared: Compared,
  ): boolean {
    if (name === ATTRIBUTE.src) {
      return true;
    }

    if (name === CSS_PROPERTY.display && !compared.visible) {
      // Rendered as shown, but its display is none now: any other display shows it.
      return given.trim() === PLAN_VALUE.none;
    }

    const read = Object.hasOwn(UNCHANGED_READ_AS, name) ? (UNCHANGED_READ_AS[name] ?? name) : name;
    const values = [given, this.#inSpace(given, compared.space)];

    return compared.renders.some((render) => {
      const written = render.get(read);

      return (
        written !== undefined && values.some((value) => this.#same(name, written, value, { tag: compared.tag, render }))
      );
    });
  }

  /** Equal as text, as a background without its files' names, or as the Figma properties its writer makes. */
  #same(
    name: string,
    written: string,
    value: string,
    scope: { readonly tag: string; readonly render: Render },
  ): boolean {
    if (written === value) {
      return true;
    }

    if (name === CSS_PROPERTY.background && this.#urls.withoutUrls(written) === this.#urls.withoutUrls(value)) {
      return true;
    }

    if (!this.#registry.owns(name)) {
      return false;
    }

    const held = this.#written(name, written, scope);

    return held !== null && isEqual(held, this.#written(name, value, scope));
  }

  /** What the writers make of one attribute over the rest of the layer's render; null when it is an error. */
  #written(
    name: string,
    value: string,
    { tag, render }: { readonly tag: string; readonly render: Render },
  ): FigmaProps | null {
    const out = new ChangeOutput();

    this.#registry.write(
      {
        tag,
        own: (attribute) => (attribute === name ? value : undefined),
        merged: (attribute) => (attribute === name ? value : render.get(attribute)),
        changed: (attribute) => attribute === name,
        hidden: false,
        existing: true,
      },
      out,
    );

    return out.problems.length > 0 ? null : out.props;
  }

  /** An element's content in design_read's terms: a Span's attributes as written, in their order. */
  #pieces(content: readonly ContentPiece[]): XmlContent[] {
    return content.map((piece) =>
      piece.kind === XML_CONTENT.text
        ? { kind: XML_CONTENT.text, value: piece.value }
        : { kind: XML_CONTENT.span, attributes: Object.entries(piece.attributes), value: piece.value },
    );
  }

  /** Content with characters side by side joined (a comment splits them in the XML) and empty ones left out. */
  #joined(content: readonly XmlContent[]): XmlContent[] {
    const joined: XmlContent[] = [];

    for (const piece of content) {
      const last = joined.at(-1);

      if (piece.kind === XML_CONTENT.text && last?.kind === XML_CONTENT.text) {
        joined[joined.length - 1] = { kind: XML_CONTENT.text, value: last.value + piece.value };
      } else if (piece.kind === XML_CONTENT.span || piece.value !== "") {
        joined.push(piece);
      }
    }

    return joined;
  }

  /** A value with its sRGB colours as a Display P3 file holds them; an sRGB file's values are as given. */
  #inSpace(value: string, space: ColorSpace): string {
    if (space === COLOR_SPACE.srgb) {
      return value;
    }

    return value.replace(UNCHANGED_PATTERN.srgb, (literal) => Color.parse(literal)?.to(space).css() ?? literal);
  }
}

export const UNCHANGED = new InjectionToken<Unchanged>("Unchanged");

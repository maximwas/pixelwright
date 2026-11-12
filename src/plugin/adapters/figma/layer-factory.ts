import { InjectionToken, injectable } from "@needle-di/core";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";

/** What only Figma's global makes for a write: new layers, a component set from its variants, a text's fonts loaded. */
@injectable()
export class LayerFactory {
  readonly #makers: Readonly<Partial<Record<NodeType, () => SceneNode>>> = {
    FRAME: () => figma.createFrame(),
    SECTION: () => figma.createSection(),
    TEXT: () => figma.createText(),
    RECTANGLE: () => figma.createRectangle(),
    ELLIPSE: () => figma.createEllipse(),
    LINE: () => figma.createLine(),
    COMPONENT: () => figma.createComponent(),
    // A frame holds a new set's variants until they are combined into the set.
    COMPONENT_SET: () => figma.createFrame(),
  };

  /** A new layer of the type, on the current page until it is put in its parent; the refusal for a type not made. */
  make(type: NodeType, refusal: string): SceneNode {
    const make = this.#makers[type];

    if (make === undefined) {
      throw new WriteError(refusal);
    }

    return make();
  }

  /** A new page, last among the file's; Figma refuses one past its plan's page limit. */
  page(): PageNode {
    return figma.createPage();
  }

  combine(
    components: ComponentNode[],
    parent: BaseNode & ChildrenMixin,
    index: number,
  ): ComponentSetNode {
    return figma.combineAsVariants(components, parent, index);
  }

  /** Every font the text uses, loaded: Figma refuses new characters on a text whose fonts are not. */
  async loadFonts(node: TextNode): Promise<void> {
    const fonts =
      node.fontName === figma.mixed ? node.getRangeAllFontNames(0, node.characters.length) : [node.fontName];

    await Promise.all(fonts.map((font) => figma.loadFontAsync(font)));
  }
}

export const LAYER_FACTORY = new InjectionToken<LayerFactory>("LayerFactory");

import { InjectionToken, injectable } from "@needle-di/core";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";

/**
 * What only Figma's global makes for a write: new layers, an icon from its SVG, an image of a file's bytes, a component
 * set from its variants, a text's fonts loaded, and the file's annotation categories and variable collections.
 */
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

  /** An icon drawn from its SVG: a frame of vector layers (FX-035: a <rect rx> becomes a vector). */
  icon(svg: string): FrameNode {
    return figma.createNodeFromSvg(svg);
  }

  /** An image of a file's bytes; Figma takes PNG, JPEG and GIF up to 4096 px a side (FX-055). */
  image(bytes: Uint8Array): Image {
    return figma.createImage(bytes);
  }

  /** The file's annotation categories: a new note is filed under one of them (T-139). */
  categories(): Promise<AnnotationCategory[]> {
    return figma.annotations.getAnnotationCategoriesAsync();
  }

  /** The file's own variable collections: a layer's mode is set in one of them (C-135). */
  collections(): Promise<VariableCollection[]> {
    return figma.variables.getLocalVariableCollectionsAsync();
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

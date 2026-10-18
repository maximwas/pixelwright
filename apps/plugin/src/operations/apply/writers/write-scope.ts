import type { FigmaProps, FontSpec } from "@pixelwright/core";
import type { ComponentIndex } from "../../../figma/component-index.ts";
import type { IdLookup } from "../../../figma/id-lookup.ts";
import type { PaintSources } from "../../../figma/paints.ts";
import type { WriteError } from "../../../figma/write-error.ts";

/** A component property a new component's layer makes, bound once its component, or its set, is complete. */
export interface PropertyMark {
  readonly node: SceneNode;
  readonly property: NonNullable<FigmaProps["property"]>;
  readonly fail: (error: unknown) => void;
}

/** What writing a layer needs from the call beyond its change: tokens, fonts, images, components, marks. */
export interface WriteScope extends PaintSources {
  /** The font a spec found and loaded, or why it could not be found. */
  font(spec: FontSpec): FontName | WriteError | undefined;
  /** Whether this Figma could not load a font a text uses: its characters cannot change. */
  isUnloaded(font: FontName): boolean;
  /** The image an Image's file makes, made once per file. */
  image(asset: { readonly src: string; readonly stream?: string }): Image;
  readonly components: ComponentIndex;
  /** The call's lookups by id: the file's own variables and styles from its lists, offline too. */
  readonly lookup: IdLookup;
  /** Holds a property a layer makes until its component is complete. */
  mark(mark: PropertyMark): void;
}

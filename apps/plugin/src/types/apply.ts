import type { FigmaProps } from "@pixelwright/core";
import type { ComponentIndex } from "../figma/apply-components.ts";
import type { TokenIndex } from "../figma/token-index.ts";
import type { WriteError } from "../figma/write-error.ts";

/** A font a text uses now, with the weight Figma reports for it (a variable font's own, like 590). */
export interface KnownFont {
  readonly fontName: FontName;
  readonly weight: number;
}

/** What writing needs beyond the change itself, made once per call. */
export interface WriteContext {
  /** Built on first use: most calls name no token. */
  readonly tokens: () => Promise<TokenIndex>;
  /** Each font the changes ask for, found and loaded, by fontKey; or why it could not be. */
  readonly fonts: ReadonlyMap<string, FontName | WriteError>;
  /** Fonts a text uses now that this Figma could not load: its characters cannot change. */
  readonly unloaded: Set<string>;
  /** The bytes an upload stream brought, if it is complete. */
  readonly uploads?: (stream: string) => Uint8Array | undefined;
  /** The images made of the call's files, by upload stream: each file once. */
  readonly images: Map<string, Image>;
  /** Components by name, looked up as needed. */
  readonly components: ComponentIndex;
  /** Properties new components' layers make, bound once their component (or its set) is complete. */
  readonly marks: { node: Layer; property: NonNullable<FigmaProps["property"]>; fail: (error: unknown) => void }[];
}

/**
 * The members of a layer design_apply writes, as one shape for every type: Figma refuses what a type lacks, and the
 * step's error says so.
 */
export interface Layer {
  readonly id: string;
  readonly type: string;
  readonly parent: Layer | null;
  readonly width: number;
  readonly height: number;
  readonly children?: readonly Layer[];
  readonly boundVariables?: Readonly<Record<string, { readonly id: string } | undefined>>;
  relativeTransform: Transform;
  resize(width: number, height: number): void;
  remove(): void;
  setBoundVariable(field: string, variable: Variable | null): void;
  insertChild(index: number, child: Layer): void;
  setFillStyleIdAsync(id: string): Promise<void>;
  setStrokeStyleIdAsync(id: string): Promise<void>;
  setEffectStyleIdAsync(id: string): Promise<void>;
  setGridChildPosition(row: number, column: number): void;
  setProperties(properties: Record<string, string | boolean>): void;
  [key: string]: unknown;
}

/** A text layer's range writers, on top of a layer's. */
export interface TextLayer extends Layer {
  characters: string;
  getStyledTextSegments(fields: string[]): (Record<string, unknown> & { start: number; end: number })[];
  getRangeAllFontNames(start: number, end: number): FontName[];
  setTextStyleIdAsync(id: string): Promise<void>;
  setRangeTextStyleIdAsync(start: number, end: number, id: string): Promise<void>;
  setRangeFillStyleIdAsync(start: number, end: number, id: string): Promise<void>;
  setRangeFontName(start: number, end: number, value: FontName): void;
  setRangeFontSize(start: number, end: number, value: number): void;
  setRangeLineHeight(start: number, end: number, value: LineHeight): void;
  setRangeLetterSpacing(start: number, end: number, value: LetterSpacing): void;
  setRangeTextCase(start: number, end: number, value: TextCase): void;
  setRangeTextDecoration(start: number, end: number, value: TextDecoration): void;
  setRangeTextDecorationStyle(start: number, end: number, value: TextDecorationStyle): void;
  setRangeTextDecorationOffset(start: number, end: number, value: TextDecorationOffset): void;
  setRangeTextDecorationThickness(start: number, end: number, value: TextDecorationThickness): void;
  setRangeTextDecorationColor(start: number, end: number, value: TextDecorationColor): void;
  setRangeFills(start: number, end: number, value: Paint[]): void;
  setRangeHyperlink(start: number, end: number, value: HyperlinkTarget | null): void;
  setRangeBoundVariable(start: number, end: number, field: VariableBindableTextField, variable: Variable | null): void;
}

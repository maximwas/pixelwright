import type { CssContext } from "../types/css.ts";
import type { SnapshotNode } from "../types/snapshot.ts";
import type { CssDeclarations } from "./css-declarations.ts";
import type { FigmaProps } from "./figma-props.ts";

/** Reads one attribute of the element being written. */
export type AttributeReader = (name: string) => string | undefined;

/** What a write rule reads: the element's own attributes, and the same over what the layer has now. */
export interface WriteInput {
  readonly tag: string;
  readonly own: AttributeReader;
  /** The element's value, else the layer's: for what Figma keeps in one property (a gap needs the direction). */
  readonly merged: AttributeReader;
  readonly changed: (name: string) => boolean;
  readonly hidden: boolean;
}

/** Where a write rule puts Figma properties, and the errors of the attributes it cannot write. */
export interface WriteOutput {
  set<K extends keyof FigmaProps>(key: K, value: Exclude<FigmaProps[K], undefined>, attribute: string): void;
  fail(attribute: string, message: string, hint?: string): void;
}

/** One line of the mapping table, backwards: the attributes it reads, run when one of them changed. */
export interface Rule {
  readonly attributes: readonly string[];
  /** A text style covers it: applying a style resets it, so the element's own value is written again. */
  readonly styled?: boolean;
  readonly write: (input: WriteInput, out: WriteOutput) => void;
}

/** What a read step reads a layer with, and where its CSS goes. */
export interface ReadScope {
  readonly node: SnapshotNode;
  /** How the layer sits: flowing in auto layout, or placed absolutely; null for a read's root without one. */
  readonly parent: SnapshotNode | null;
  readonly context: CssContext;
  readonly css: CssDeclarations;
}

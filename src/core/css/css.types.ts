import type { CssDeclarations } from "@/core/css/registry/css-declarations.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** What a group reads a layer with: the layer, its parent (how it sits; null for the read's root), the read, the CSS. */
export interface CssScope {
  readonly layer: ReadLayer;
  readonly parent: ReadLayer | null;
  readonly model: ReadModel;
  readonly css: CssDeclarations;
}

/**
 * One group of the mapping table (C-172): the CSS attributes it owns (no other group writes them), the read-model fields
 * they come from (so an error names the attribute's source), and its read; its write half is a PropertyWriter.
 */
export interface PropertyGroup {
  readonly attributes: readonly string[];
  readonly sources: readonly string[];
  read(scope: CssScope): void;
}

/** Reads one attribute of the element being written. */
type AttributeReader = (name: string) => string | undefined;

/** What a write half reads: the element's own attributes, and the same over what the layer has now. */
export interface WriteInput {
  readonly tag: string;
  readonly own: AttributeReader;
  /** The element's value, else the layer's: for what Figma keeps in one property (a gap needs the direction). */
  readonly merged: AttributeReader;
  readonly changed: (name: string) => boolean;
  /** Whether the layer is hidden now: a display other than none shows it again. */
  readonly hidden: boolean;
  /** Whether the element changes a layer there (a copy's included), not one it makes. */
  readonly existing: boolean;
}

/** An attribute a write could not turn into Figma's terms: why, and what to do. */
export interface WriteProblem {
  readonly attribute: string;
  readonly message: string;
  readonly hint?: string;
}

/** Where a write half puts Figma properties and the attribute each came from, and the errors of those it cannot write. */
export interface WriteOutput {
  set<Key extends keyof FigmaProps>(key: Key, value: Exclude<FigmaProps[Key], undefined>, attribute: string): void;
  fail(attribute: string, message: string, hint?: string): void;
}

/** The write half of a group (C-172, backwards): the attributes it owns, written when one of them changed. */
export interface PropertyWriter {
  readonly attributes: readonly string[];
  write(input: WriteInput, out: WriteOutput): void;
}

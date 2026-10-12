import type { SnapshotNode } from "@pixelwright/core";

/** A Code Connect template file of the project, with what the comments at its top say. */
export interface TemplateFile {
  /** Relative to the project root, with forward slashes. */
  readonly path: string;
  readonly source: string;
  readonly url?: string;
  /** The url's node-id as the Plugin API writes ids: 1-2 → 1:2. */
  readonly nodeId?: string;
  readonly fileKey?: string;
  /** The `component` comment: the Figma component's or component set's name. */
  readonly component?: string;
  /** The `source` comment: the code component's file. */
  readonly codeSource?: string;
}

/** What design_read knows of an instance's component. */
export type SnapshotInstance = NonNullable<SnapshotNode["instance"]>;

/** Figma's Template API result sections (figma-types.d.ts): code, a nested instance, a slot, an error. */
export type ResultSection =
  | { type: "CODE"; code: string; nestedImports?: string[] }
  | { type: "INSTANCE"; guid: string; symbolId: string; resultSections?: ResultSection[]; nestedImports?: string[] }
  | { type: "SLOT"; guid?: string; propertyName: string }
  | { type: "ERROR"; message: string };

/** What figma.code`…` and its siblings return. */
export interface TemplateStringResult {
  readonly type: "SECTIONS";
  readonly language: string;
  readonly sections: ResultSection[];
}

/** One instance as its template renders it, or the template's error; null when no template connects it. */
export type RenderedInstance =
  | { component: string; template: string; snippet: string; imports: string[] }
  | { template: string; error: string };

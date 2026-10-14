import type { Context } from "node:vm";
import type { SnapshotNode } from "@pixelwright/core";

/**
 * A connection of the project's Code Connect files: a template file with what the comments at its top say, or one row
 * of a batch file, run through the batch's shared template.
 */
export interface TemplateFile {
  /** Relative to the project root, with forward slashes; a batch row's is `<batch file>#<n>`. */
  readonly path: string;
  /** The template's absolute path, which its relative imports start from. */
  readonly file?: string;
  readonly source: string;
  readonly url?: string;
  /** The url's node-id as the Plugin API writes ids: 1-2 → 1:2. */
  readonly nodeId?: string;
  readonly fileKey?: string;
  /** The component's or component set's key (Pixelwright's `// key=`, a row's "key"): it matches by key only. */
  readonly key?: string;
  /** The `component` comment or a row's: the code component's name, as Figma's Code Connect defines it. */
  readonly component?: string;
  /** The `source` comment or a row's: the code component's file or package. */
  readonly codeSource?: string;
  /** A batch row as written, frozen: what its template reads as figma.batch. */
  readonly batch?: Readonly<Record<string, unknown>>;
  /** The batch file a row comes from, relative to the project root. */
  readonly batchFile?: string;
  /** The shared template a batch file's rows run, one object for them all: it is compiled once. */
  readonly shared?: SharedTemplate;
}

/** A batch file's shared template: its path from the project root, its absolute path and its text. */
export interface SharedTemplate {
  readonly path: string;
  readonly file: string;
  readonly source: string;
  /** Its own `// component=` and `// source=` comments: a row without its own takes them, as Figma's CLI does. */
  readonly component?: string;
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

/** A template's code or a helper module's: a template exports its default and nothing else. */
export type ModuleKind = "template" | "helper";

/** A module's code as compile runs it, and the id a template's default export writes as a literal. */
export interface Transformed {
  readonly code: string;
  readonly id: string | null;
}

/** A template compiled once: a context of its own, the function its source became, its relative helpers' functions. */
export interface Compiled {
  readonly context: Context;
  /** The `id` its default export writes as a literal, known without running it. */
  readonly id: string | null;
  readonly helpers: Map<string, (...args: unknown[]) => void>;
}

/** What one run of a template exports. */
export interface Executed {
  readonly sections: ResultSection[];
  readonly imports: string[];
  readonly id: string | null;
  readonly metadata?: unknown;
}

import type { BaselineChanges, BaselineCounts } from "@/core/diff/baseline/baseline.schema.ts";
import type { VariableContext } from "@/core/tokens/model/variable-css.ts";
import type { XmlElement } from "@/core/xml/xml.types.ts";
import type { RawCollection, RawTokens, RawVariable } from "@/shared/ops/variables/variables.schema.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** A layer of one side: design_read's element, its parent's id, its Figma name, its label and where it is. */
export interface Placed {
  readonly element: XmlElement;
  readonly parent: string | null;
  readonly name: string;
  /** Its tag and its name cut short: Text "Plans". */
  readonly label: string;
  /** The labels below the root joined by " / "; the root's is "(root)". */
  readonly path: string;
}

/** One side's layers by id, in document order. */
export type Side = ReadonlyMap<string, Placed>;

/** A layer of the baseline and the one paired with it now. */
export type PlacedPair = readonly [Placed, Placed];

/** One side of a comparison: a layer's read and the tokens it uses, null when they could not be read. */
export interface BaselineSide {
  readonly snapshot: ReadModel;
  readonly tokens: RawTokens | null;
}

/** Both reads' layers by id, hidden ones included: what draws a layer, and what hid it. */
export interface ReadSides {
  readonly before: ReadonlyMap<string, ReadLayer>;
  readonly after: ReadonlyMap<string, ReadLayer>;
}

/** What comparing the pairs needs: both reads' layers, whether one plugin version read both, the roots' pages. */
export interface PairSources extends ReadSides {
  readonly sameReader: boolean;
  readonly pages: readonly [ReadModel["page"], ReadModel["page"]];
}

/** The same thing on both sides of a comparison. */
export interface Both<T> {
  readonly before: T;
  readonly after: T;
}

/**
 * One side's tokens (K-057): its raw tokens (null when they could not be read), its read, its compared layers, and the
 * layers under a cut on either side, whose tokens are left out too.
 */
export interface TokenSide {
  readonly raw: RawTokens | null;
  readonly snapshot: ReadModel;
  readonly layers: Side;
  readonly skip: ReadonlySet<string>;
}

/** One compared element's values for TokenChanges: its attributes' and its spans', and the text style it names. */
export interface ElementValues {
  readonly values: readonly string[];
  readonly textStyle: string | undefined;
}

/** What a side's layers bind at any depth: variables by their aliases, styles by id. */
export interface BoundTokens {
  readonly variables: Set<string>;
  readonly styles: Set<string>;
}

/** A side's tokens ready to write: its variables and collections by id, and what writing a value needs. */
export interface SideTokens {
  readonly variables: ReadonlyMap<string, RawVariable>;
  readonly collections: ReadonlyMap<string, RawCollection>;
  readonly context: VariableContext;
}

/** A variable of one side, with its token and its collection's modes. */
export interface SideVariable {
  readonly variable: RawVariable;
  readonly token: string;
  readonly modes: readonly RawCollection["modes"][number][];
  readonly side: SideTokens;
}

/** A variable either side uses: per side the bound ones it is reached through ([] when bound), undefined when unused. */
export interface VariableUse {
  readonly id: string;
  readonly before: readonly string[] | undefined;
  readonly after: readonly string[] | undefined;
}

/** A token entry's parts beside the variable it shows. */
export interface TokenEntryParts {
  readonly was: string | undefined;
  readonly mode: string | undefined;
  readonly pair: readonly [string | null, string | null];
  readonly layers: number;
}

/** A baseline against the design now (K-055). */
export interface BaselineComparison {
  /** Nothing changed: every list of changes is empty (what was not compared is no change). */
  readonly same: boolean;
  readonly changes: BaselineChanges;
  /** How many entries each list held before the cap. */
  readonly counts: BaselineCounts;
  /** The entries past the cap, all lists together. */
  readonly more: number;
  readonly notes: string[];
}

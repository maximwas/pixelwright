import type { BaselineChanges, BaselineCounts } from "@/core/diff/baseline/baseline.schema.ts";
import type { XmlElement } from "@/core/xml/xml.types.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";
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

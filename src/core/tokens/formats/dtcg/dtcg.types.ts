import type { ColorSpace } from "@/core/kernel/color/color.ts";
import type { DTCG_KEY, DTCG_TYPE } from "@/core/tokens/formats/dtcg/dtcg.constants.ts";
import type { RawTokens, RawVariable } from "@/shared/ops/variables/variables.schema.ts";

export type DtcgType = (typeof DTCG_TYPE)[keyof typeof DTCG_TYPE];

/** A DTCG token (Design Tokens Format Module 2025.10): its type, its value or an alias, and its description. */
export interface DtcgToken {
  $type: DtcgType;
  $value: unknown;
  $description?: string;
}

/** A DTCG group: tokens and groups by name; a token whose path is also a group sits at `$root`. */
export interface DtcgGroup {
  [name: string]: DtcgGroup | DtcgToken;
}

/** tokens_read's DTCG output (K-013): a tree per collection mode and one of styles, and what DTCG could not hold. */
export interface DtcgResult {
  readonly trees: Record<string, DtcgGroup>;
  readonly notes: string[];
}

/** A colour as DTCG writes one (K-016). */
export interface DtcgColor {
  readonly colorSpace: ColorSpace;
  readonly components: readonly number[];
  readonly alpha?: number;
  readonly hex: string;
}

/** A length as DTCG writes one. */
export interface DtcgDimension {
  readonly value: number;
  readonly unit: typeof DTCG_KEY.px;
}

/** Something placed in a tree: its id, its name, and the path its name gives. */
export interface PathEntry {
  readonly id: string;
  readonly name: string;
  readonly path: readonly string[];
}

/** Where every typed variable sits in its collection's trees, and how an alias names each, a library's included. */
export interface DtcgPlaces {
  readonly types: ReadonlyMap<string, DtcgType | null>;
  readonly locations: ReadonlyMap<string, readonly string[]>;
  readonly references: ReadonlyMap<string, string>;
  /** Variables whose path another took first, in the collections written, as notes. */
  readonly renamed: readonly string[];
}

/** One write of the variables' trees: what it reads, and what it had to rename or leave out, for the notes. */
export interface DtcgWriting {
  readonly raw: RawTokens;
  /** The ids of the collections written. */
  readonly written: ReadonlySet<string>;
  readonly places: DtcgPlaces;
  readonly space: ColorSpace;
  readonly variables: ReadonlyMap<string, RawVariable>;
  readonly renamed: string[];
  readonly untyped: Map<string, string>;
  readonly lost: Set<string>;
  readonly outside: Map<string, string>;
  readonly unwritten: Set<string>;
}

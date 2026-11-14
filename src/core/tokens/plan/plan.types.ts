import type { StyleGroup } from "@/core/tokens/model/model.constants.ts";
import type { StyleToken, TokenVariable } from "@/core/tokens/model/model.schema.ts";
import type { NumberUnit } from "@/core/tokens/model/number-units.ts";
import type {
  TokenError,
  TokenItem,
  TokensPlan,
  VariablePlan,
  WritableType,
} from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";

/** A collection of the file with its variables as tokens_read writes them; a library's marked remote. */
export interface HeldCollection {
  readonly id: string;
  readonly name: string;
  readonly remote: boolean;
  readonly modes: readonly string[];
  readonly variables: readonly TokenVariable[];
}

/** A style of the file with its token, and its CSS as tokens_read writes it when CSS can draw it. */
export interface HeldStyle {
  readonly id: string;
  readonly name: string;
  readonly group: StyleGroup;
  readonly remote: boolean;
  readonly token: string;
  readonly css?: StyleToken;
}

/** A variable an alias can reach: the file's own, a library's the page uses, or an enabled library's by its key. */
export interface HeldTarget {
  /** An enabled library's variable the file does not use yet has its key here too: it has no id in the file. */
  readonly id: string;
  readonly type: string;
  /** The key the write imports an enabled library's variable by (m:acc257ba). */
  readonly key?: string;
  /** The token each mode points at when its value is an alias (a library's variable shows none). */
  readonly aliases: Readonly<Record<string, string>>;
}

/** What the file holds, as tokens_apply finds it by name. */
export interface FileTokens {
  readonly collections: readonly HeldCollection[];
  readonly styles: readonly HeldStyle[];
  /** Every variable by its token: the file's own and the libraries' its aliases point at. */
  readonly tokens: ReadonlyMap<string, HeldTarget>;
  /** Each token more than one of those variables has, with their collections: an alias to it cannot tell which. */
  readonly shared: ReadonlyMap<string, readonly string[]>;
  /** Each number variable's unit, by id (K-003). */
  readonly units: ReadonlyMap<string, NumberUnit>;
  /** The collections the enabled libraries offer, by name: never copied into the file. */
  readonly library: ReadonlySet<string>;
}

/** A variable's plan before its aliases are followed: a new variable of only aliases has no type yet. */
type UnlinkedPlan = Omit<VariablePlan, "type"> & { readonly type: WritableType | null };

/** A variable read from the call, its aliases not yet followed to their targets. */
export interface UnlinkedEntry {
  readonly plan: UnlinkedPlan;
  readonly token: string;
  readonly css: readonly string[];
}

/** A collection read from the call, its variables not yet linked. */
export interface UnlinkedCollection {
  readonly name: string;
  readonly id?: string;
  readonly modes: readonly string[];
  readonly entries: readonly UnlinkedEntry[];
}

/** A variable planned: what to write, the CSS name aliases reach it by, and the CSS of its values but aliases. */
export interface VariableEntry {
  readonly plan: VariablePlan;
  readonly token: string;
  readonly css: readonly string[];
}

/** A collection planned: the file's (its id) or a new one, the modes to add and the variables to write. */
export interface CollectionDraft {
  readonly name: string;
  readonly id?: string;
  readonly modes: readonly string[];
  readonly entries: readonly VariableEntry[];
}

/** The drafts with their numbers as Figma keeps them, and what will not read back as given. */
export interface NumberedDrafts {
  readonly drafts: CollectionDraft[];
  readonly notes: string[];
}

/** Says why a variable, or one of its modes, cannot be written. */
export type Fail = (message: string, mode?: string) => void;

/** The plan, what it makes and changes, what cannot be written and why, and what will not read back as given. */
export interface PlannedTokens {
  readonly plan: TokensPlan;
  readonly created: TokenItem[];
  readonly updated: TokenItem[];
  readonly errors: TokenError[];
  readonly notes: string[];
}

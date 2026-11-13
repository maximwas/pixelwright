import type { StyleGroup } from "@/core/tokens/model/model.constants.ts";
import type { StyleToken, TokenVariable } from "@/core/tokens/model/model.schema.ts";
import type { NumberUnit } from "@/core/tokens/model/number-units.ts";
import type { TokenError, TokenItem, TokensPlan, VariablePlan } from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";

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

/** What the file holds, as tokens_apply finds it by name. */
export interface FileTokens {
  readonly collections: readonly HeldCollection[];
  readonly styles: readonly HeldStyle[];
  /** Every variable's token: the file's own and the libraries' its aliases point at. */
  readonly tokens: ReadonlySet<string>;
  /** Each number variable's unit, by id (K-003). */
  readonly units: ReadonlyMap<string, NumberUnit>;
  /** The collections the enabled libraries offer, by name: never copied into the file. */
  readonly library: ReadonlySet<string>;
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

import type { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";

export type OpTurn = (typeof OP_TURN)[keyof typeof OP_TURN];

export type OpName = (typeof OP_NAME)[keyof typeof OP_NAME];

/** A meta value fixed for the op, or resolved from its parsed input (apply's dry run needs no Allow edits). */
export type PerInput<Input, Value> = Value | ((input: Input) => Value);

/** What the server and the plugin both read from an op (A§5.5, D-07): one source, never a hand-kept list. */
export interface OpMeta<Input> {
  /** Changes the file: the timeout text says it may still be writing. */
  readonly write: PerInput<Input, boolean>;
  /** The input has dryRun and the op honours it (D-41). */
  readonly dryRun: boolean;
  /** The server's wait and the plugin watchdog's limit (S-009, D-06). */
  readonly timeoutMs: PerInput<Input, number>;
  /** The plugin refuses the op while Allow edits is off (D-07, P-010). */
  readonly needsAllowEdits: PerInput<Input, boolean>;
  readonly turn: OpTurn;
  /** Not listed in the window's activity (ping). */
  readonly quiet?: boolean;
}

/** The meta of one call, its functions resolved against the parsed input. */
export interface ResolvedOpMeta {
  readonly write: boolean;
  readonly dryRun: boolean;
  readonly timeoutMs: number;
  readonly needsAllowEdits: boolean;
  readonly turn: OpTurn;
  readonly quiet: boolean;
}

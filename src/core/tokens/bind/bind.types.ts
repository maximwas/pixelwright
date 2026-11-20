import type { TextLength } from "@/core/css/fonts/font-shorthand.ts";
import type { BIND_DECISION, BIND_SCOPE, FIELD_RULE } from "@/core/tokens/bind/bind.constants.ts";
import type { BindResult } from "@/core/tokens/bind/bind.schema.ts";
import type { BIND_KIND, BIND_SOURCE } from "@/shared/ops/bind/bind.constants.ts";
import type { BindPlace, BindPlan } from "@/shared/ops/bind/bind.schema.ts";

export type BindKind = (typeof BIND_KIND)[keyof typeof BIND_KIND];

export type BindScope = (typeof BIND_SCOPE)[keyof typeof BIND_SCOPE];

export type FieldRule = (typeof FIELD_RULE)[keyof typeof FIELD_RULE];

/** A layer's variable modes, collection id to mode id (Figma's resolvedVariableModes). */
export type ModeMap = Readonly<Record<string, string>>;

/** A style or variable a raw value may be bound to, named by its token as tokens_read writes it. */
export interface BindCandidate {
  readonly token: string;
  readonly id: string;
  readonly source: (typeof BIND_SOURCE)[keyof typeof BIND_SOURCE];
  /** A variable's resolved type (COLOR, FLOAT…), a style's kind (PAINT, TEXT, EFFECT). */
  readonly type: string;
  /** The variable a paint style's one paint is bound to: the style is that variable under another name. */
  readonly wraps?: string;
  /** A library's variable the file does not hold yet, which Figma inferred: the key the writer imports it by. */
  readonly key?: string;
}

/** A single number field: the CSS word results name it by, the scope its variables need, and when it counts. */
export interface NumberField {
  readonly css: string;
  readonly scope: BindScope;
  readonly rule: FieldRule;
}

/** Four fields of one value, and the one field of a layer that has no four. */
export interface FieldGroup {
  readonly fields: readonly string[];
  readonly single: string;
  readonly css: string;
  readonly scope: BindScope;
  readonly stroked: boolean;
}

/** A raw number in one field or a group of them, with what its variables need. */
export interface NumberUse {
  readonly fields: readonly string[];
  readonly css: string;
  readonly scope: BindScope;
  readonly value: number;
}

/** The parts of a text a text style sets: what two texts share when one style fits both. */
export interface TextParts {
  readonly fontName: { readonly family: string; readonly style: string };
  readonly fontSize: number;
  readonly lineHeight: TextLength;
  readonly letterSpacing: TextLength;
  readonly textCase: string;
  readonly textDecoration: string;
}

/** One raw value on a layer as tokens_bind lists it, with the tokens holding it exactly. */
export interface BindUse {
  readonly layer: string;
  readonly kind: BindKind;
  /** Where the value is, by its CSS name: background, border, color, gap, padding, border-radius, font, effects. */
  readonly field: string;
  readonly value: string;
  readonly candidates: readonly BindCandidate[];
  /** Whether a paint style may take its place: a paint style is the whole list of a layer's paints. */
  readonly stylable: boolean;
  /** Where the writer binds it: a paint's list, index and opacity, a number's Figma fields, a run's range. */
  readonly place: BindPlace;
}

/** The call's pick for a value several tokens hold, or a value to snap to a token. */
export interface BindChoice {
  readonly value: string;
  readonly token: string;
  readonly field?: string | undefined;
}

/** Every use of one token rebound to another of its kind. */
export interface BindRemap {
  readonly from: string;
  readonly to: string;
}

/** One token's uses to rebind to another, both found: as the call named them, and the style or variable each is. */
export interface RemapPair {
  readonly from: string;
  readonly to: string;
  readonly source: BindCandidate;
  readonly target: BindCandidate;
}

/** tokens_bind's plan: the answer, grouped by value, and every use a real run binds, for the writer (item 51). */
export interface BindPlanned {
  readonly result: BindResult;
  readonly plan: BindPlan;
}

/** What core plans with besides the file's tokens and the scan: the call's picks and rebinds. */
export interface BindRequest {
  readonly choose: readonly BindChoice[];
  readonly remap: readonly BindRemap[];
}

/** What becomes of a raw value: bound to a token (snapped when it was not the token's), left, or a pick refused. */
export type BindDecision =
  | { readonly kind: typeof BIND_DECISION.bound; readonly candidate: BindCandidate; readonly snapped: boolean }
  | { readonly kind: typeof BIND_DECISION.ambiguous }
  | { readonly kind: typeof BIND_DECISION.unmatched }
  | { readonly kind: typeof BIND_DECISION.refused; readonly message: string };

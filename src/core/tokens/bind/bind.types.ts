import type { TextLength } from "@/core/css/fonts/font-shorthand.ts";
import type { BIND_DECISION, BIND_SCOPE, BIND_SOURCE, FIELD_RULE } from "@/core/tokens/bind/bind.constants.ts";
import type { BIND_KIND } from "@/shared/ops/bind/bind.constants.ts";

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

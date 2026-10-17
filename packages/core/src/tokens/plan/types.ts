import type { EffectSpec, FontSpec, PaintSpec } from "../../css-mapping/figma-props.ts";
import type { ColorValue } from "../../kernel/color/color.ts";
import type { CodeSyntax, VariableScopeName } from "../scopes.ts";

/** The variable types tokens_apply writes. */
export type WritableVariableType = "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";

/** A variable's value in one mode, in Figma's terms; an alias names its target by token. */
export type VariableValueSpec =
  | { readonly kind: "color"; readonly color: ColorValue }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "alias"; readonly token: string };

export interface VariablePlan {
  readonly name: string;
  /** Null when every value is an alias: the variable takes its target's type. */
  readonly type: WritableVariableType | null;
  /** By mode name. */
  readonly values: Readonly<Record<string, VariableValueSpec>>;
  readonly description?: string;
  /** Its CSS name when that is not the one its name gives: written as its WEB code syntax, unless that is given. */
  readonly token?: string;
  /** The fields Figma's pickers offer it for, when the call gives them. */
  readonly scopes?: readonly VariableScopeName[];
  /** Its name in code per platform, when the call gives it: "" removes a platform's. */
  readonly codeSyntax?: CodeSyntax;
  /**
   * Its numbers were written without a unit and nothing in the call scopes it as a plain number: Figma will offer it
   * for every field, and tokens_read will write its numbers in px.
   */
  readonly unitless?: true;
}

export interface CollectionPlan {
  readonly name: string;
  readonly modes: readonly string[];
  readonly variables: readonly VariablePlan[];
}

export interface PaintStylePlan {
  readonly name: string;
  readonly paints: readonly PaintSpec[];
}

export interface TextStylePlan {
  readonly name: string;
  readonly font: FontSpec;
}

export interface EffectStylePlan {
  readonly name: string;
  readonly effects: readonly EffectSpec[];
}

/** What tokens_apply asks the plugin to write, in Figma's terms. */
export interface TokensPlan {
  readonly collections: readonly CollectionPlan[];
  readonly styles: {
    readonly paint: readonly PaintStylePlan[];
    readonly text: readonly TextStylePlan[];
    readonly effect: readonly EffectStylePlan[];
  };
}

export type TokenKind = "collection" | "mode" | "variable" | "paint" | "text" | "effect";

/** Something tokens_apply made or changed. */
export interface TokenItem {
  readonly kind: TokenKind;
  readonly name: string;
  readonly collection?: string;
}

/** Something tokens_apply could not write, and why. */
export interface TokenError extends TokenItem {
  readonly mode?: string;
  readonly message: string;
}

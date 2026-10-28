import type { ColorSpace } from "../../kernel/color/color-space.ts";
import type { BindKind } from "../../tokens/bind/fields.ts";
import type { BindOutput } from "../../tokens/bind/schemas.ts";
import type { ContrastText } from "../../types/contrast.ts";
import type { SnapshotNode } from "../../types/snapshot.ts";
import type { ComponentEntry } from "../states/component-states.ts";
import type { LintFinding, LintRuleId, LintSeverity } from "./schemas.ts";

/** A layer as a rule sees it: the layer, its parent, the read it is in, and what holds it. */
export interface LintLayer {
  readonly node: SnapshotNode;
  readonly parent: SnapshotNode | null;
  readonly root: SnapshotNode;
  /** The layer comes from a component through an instance: its look is the component's. */
  readonly inInstance: boolean;
  /** The layer is part of a main component (or a set): its hidden layers are property-driven. */
  readonly inComponent: boolean;
}

/** What the rules share in one lint: the tokens holding raw values, the components used, contrast, the colour space. */
export interface LintContext {
  readonly hints: BindHints;
  readonly components: ReadonlyMap<string, ComponentEntry>;
  readonly contrast: ReadonlyMap<string, ContrastText>;
  readonly space: ColorSpace;
  /** The sets already reported for missing states: one finding per set, however many instances. */
  readonly reportedSets: Set<string>;
}

/** A rule: what it finds, how much that matters, and the findings a layer gives. */
export interface LintRule {
  readonly id: LintRuleId;
  readonly severity: LintSeverity;
  readonly about: string;
  /** The rule looks at hidden layers too (only their names and boxes are read). */
  readonly hidden?: boolean;
  readonly check: (layer: LintLayer, context: LintContext) => readonly LintFinding[];
}

/** A finding of a rule about a layer. */
export function findingOf(
  rule: Pick<LintRule, "id" | "severity">,
  node: Pick<SnapshotNode, "id" | "name">,
  { message, fix, severity }: { message: string; fix?: string | undefined; severity?: LintSeverity },
): LintFinding {
  return {
    rule: rule.id,
    severity: severity ?? rule.severity,
    id: node.id,
    name: node.name,
    message,
    ...(fix === undefined ? {} : { fix }),
  };
}

/** How a fix says no token holds a value, by its kind. */
const NONE: Readonly<Record<BindKind, string>> = {
  color: "No token holds",
  number: "No token holds",
  text: "No text style sets",
  effect: "No effect style holds",
};

/** What tokens_bind's dry run found for a value: the token binding it, the ones holding it, or none. */
export type ValueHint = { readonly token: string } | { readonly candidates: readonly string[] } | null;

/** tokens_bind's dry run over the same layers, by value: how design_lint knows which token a raw value is. */
export class BindHints {
  readonly #bound = new Map<string, string>();
  readonly #ambiguous = new Map<string, readonly string[]>();
  readonly #known: boolean;

  constructor(bind: BindOutput | null) {
    this.#known = bind !== null;

    for (const group of bind?.bound ?? []) {
      if (group.snapped === undefined) {
        this.#bound.set(`${group.kind}|${group.field}|${group.value}`, group.token);
      }
    }

    for (const group of bind?.ambiguous ?? []) {
      this.#ambiguous.set(`${group.kind}|${group.field}|${group.value}`, group.candidates);
    }
  }

  /** Whether the dry run ran: an older plugin has no bind, and the fix hints then name the tool only. */
  get known(): boolean {
    return this.#known;
  }

  of(kind: BindKind, field: string, value: string): ValueHint {
    const key = `${kind}|${field}|${value}`;
    const token = this.#bound.get(key);
    const candidates = this.#ambiguous.get(key);

    if (token !== undefined) {
      return { token };
    }

    return candidates === undefined ? null : { candidates };
  }

  /**
   * How the fix of a layer's raw values reads, in one sentence a kind: which tokens tokens_bind binds them to, the ones
   * to pick from where several hold a value, and what to do with values none holds.
   */
  fixOf(kind: BindKind, values: readonly { field: string; value: string }[], none: string): string {
    const one = values.length === 1;

    if (!this.#known) {
      return one
        ? `tokens_bind binds it to the token holding it, if one does; else ${none}.`
        : `tokens_bind binds them to the tokens holding them, if any do; else ${none}.`;
    }

    const bound: string[] = [];
    const picks: string[] = [];
    const missing: string[] = [];

    for (const { field, value } of values) {
      const hint = this.of(kind, field, value);

      if (hint === null) {
        missing.push(value);
      } else if ("token" in hint) {
        bound.push(`${one ? "it" : `${field} ${value}`} to ${hint.token}`);
      } else {
        picks.push(`${hint.candidates.join(", ")} hold ${value}`);
      }
    }

    return [
      bound.length > 0 ? `tokens_bind binds ${bound.join(", ")}.` : null,
      picks.length > 0 ? `${picks.join("; ")}: tokens_bind with choose picks one.` : null,
      missing.length > 0 ? `${NONE[kind]} ${[...new Set(missing)].join(", ")}: ${none}.` : null,
    ]
      .filter((sentence) => sentence !== null)
      .join(" ");
  }
}

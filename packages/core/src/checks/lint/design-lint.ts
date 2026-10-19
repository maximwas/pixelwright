import { colorSpaceOf } from "../../kernel/color/color-space.ts";
import type { BindOutput } from "../../tokens/bind/schemas.ts";
import type { ContrastText } from "../../types/contrast.ts";
import type { Snapshot, SnapshotNode } from "../../types/snapshot.ts";
import { contrastCheck } from "../contrast.ts";
import type { ComponentEntry } from "../states/component-states.ts";
import { BindHints, type LintContext, type LintLayer, type LintRule } from "./lint-rule.ts";
import { LINT_RULES } from "./lint-rules.ts";
import type { DesignLint, LintFinding, LintRuleId, LintSeverity } from "./schemas.ts";

const RANK: Readonly<Record<LintSeverity, number>> = {
  error: 0,
  warning: 1,
  info: 2,
};

/** What design_lint reads: each root's snapshot, tokens_bind's dry run over them, and the components they use. */
export interface LintInput {
  readonly reads: readonly Snapshot[];
  /** How many roots could not be read: the summary says they were not checked. */
  readonly unread?: number;
  readonly bind?: BindOutput | null;
  readonly components?: readonly ComponentEntry[];
}

/** What a lint checks and shows: which rules, the lowest severity listed, how many findings, and its scope's name. */
export interface LintOptions {
  readonly rules?: readonly LintRuleId[] | undefined;
  readonly severity?: LintSeverity | undefined;
  readonly limit: number;
  readonly scope: string;
}

/**
 * The general rules a design should keep, checked on each read root: contrast, raw colours, text and effect styles,
 * detached components, stacks without auto layout, overflow, touch targets, states, the scale, names and leftovers.
 * Each finding names its layer and how to fix it; errors come first.
 */
export function designLint(input: LintInput, options: LintOptions): DesignLint {
  const rules = LINT_RULES.filter(({ id }) => options.rules === undefined || options.rules.includes(id));
  const lowest = RANK[options.severity ?? "info"];
  const { found, notes } = findingsOf(input, rules);
  const shown = found
    .filter(({ severity }) => RANK[severity] <= lowest)
    .sort((a, b) => RANK[a.severity] - RANK[b.severity]);

  return {
    summary: summaryOf(shown, options, {
      read: input.reads.length,
      unread: input.unread ?? 0,
    }),
    rules: rules.flatMap((rule) => {
      const own = shown.filter((finding) => finding.rule === rule.id);
      // A rule's findings may be milder than the rule (a touch target under 44 px is info): list the most severe shown.
      const [worst] = own;

      return worst === undefined
        ? []
        : [
            {
              rule: rule.id,
              severity: worst.severity,
              count: own.length,
              about: rule.about,
            },
          ];
    }),
    findings: shown.slice(0, options.limit),
    more: shown.length > options.limit,
    notes,
  };
}

/** Every finding of the rules on every read root, and where a read was cut short. */
function findingsOf(input: LintInput, rules: readonly LintRule[]): { found: LintFinding[]; notes: string[] } {
  const components = new Map((input.components ?? []).map((entry) => [entry.id, entry]));
  const hints = new BindHints(input.bind ?? null);
  const reportedSets = new Set<string>();
  const found: LintFinding[] = [];
  const notes: string[] = [];

  for (const snapshot of input.reads) {
    const context: LintContext = {
      hints,
      components,
      contrast: failingTexts(snapshot),
      space: colorSpaceOf(snapshot.colorProfile),
      reportedSets,
    };

    walk(
      snapshot.root,
      {
        parent: null,
        root: snapshot.root,
        inInstance: false,
        inComponent: false,
      },
      (layer) => found.push(...checked(rules, layer, context)),
    );
    notes.push(...cutNotes(snapshot.root));
  }

  return {
    found,
    notes,
  };
}

/** The rules' findings on one layer; a hidden layer only for the rules that look at hidden layers. */
function checked(rules: readonly LintRule[], layer: LintLayer, context: LintContext): LintFinding[] {
  return rules.filter((rule) => layer.node.visible || rule.hidden).flatMap((rule) => [...rule.check(layer, context)]);
}

/**
 * Visits a layer and, when it is shown, its children: inside an instance, inside a main component, or neither. What a
 * slot holds is the instance's own content, not its component's, so it is linted as any layer.
 */
function walk(node: SnapshotNode, where: Omit<LintLayer, "node">, visit: (layer: LintLayer) => void): void {
  const inInstance = where.inInstance || node.type === "INSTANCE";

  visit({
    node,
    ...where,
    inInstance,
  });

  if (!node.visible) {
    return;
  }

  for (const child of node.children ?? []) {
    walk(
      child,
      {
        parent: node,
        root: where.root,
        inInstance: inInstance && node.type !== "SLOT",
        inComponent: where.inComponent || node.type === "COMPONENT" || node.type === "COMPONENT_SET",
      },
      visit,
    );
  }
}

/** The texts below AA, or over what contrast cannot be measured on, by id: a text's worst run, a ratio before none. */
function failingTexts(snapshot: Snapshot): Map<string, ContrastText> {
  return new Map(
    contrastCheck(snapshot)
      .texts.filter((text) => !text.aa)
      // Each run of a text has a row: sorted best first, so the worst one is set last and kept.
      .toSorted((a, b) => (b.ratio ?? Number.MAX_VALUE) - (a.ratio ?? Number.MAX_VALUE))
      .map((text) => [text.id, text]),
  );
}

/** Where the read stopped at its size budget: the layers below were not linted. */
function cutNotes(root: SnapshotNode): string[] {
  const cut: SnapshotNode[] = [];
  const find = (node: SnapshotNode) => {
    if (node.visible && node.childCount > (node.children?.length ?? 0)) {
      cut.push(node);
    }

    for (const child of node.children ?? []) {
      find(child);
    }
  };

  find(root);

  return cut.length === 0
    ? []
    : [
        `The read of ${root.id} "${root.name}" stopped at its size budget, so ${cut.length} layer${cut.length === 1 ? "'s" : "s'"} children were not linted (first ${cut[0]?.id}): lint them with within.`,
      ];
}

/** The findings by severity; roots that could not be read come first, so they never pass for clean ones. */
function summaryOf(
  findings: readonly LintFinding[],
  { limit, scope }: LintOptions,
  { read, unread }: { read: number; unread: number },
): string {
  const where = unread === 0 ? scope : "the rest";
  const prefix =
    unread === 0 ? "" : `Not checked: ${unread} of ${read + unread} layers could not be read (the notes say why). `;

  if (findings.length === 0) {
    return `${prefix}No findings in ${where} for the rules checked.`;
  }

  const of = (severity: LintSeverity) => findings.filter((finding) => finding.severity === severity).length;
  const counts = [`${of("error")} errors`, `${of("warning")} warnings`, `${of("info")} info`].join(", ");

  return `${prefix}${findings.length} findings in ${where}: ${counts}${findings.length > limit ? `; the first ${limit} are listed` : ""}.`;
}

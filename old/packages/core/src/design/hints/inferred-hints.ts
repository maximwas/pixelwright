import { INFERRED_WORDS } from "../../constants/inferred.ts";
import { decimalPx, px } from "../../css-mapping/values/format.ts";
import { variableTokenName } from "../../kernel/names.ts";
import { decimal } from "../../kernel/numbers.ts";
import type { Snapshot, SnapshotNode } from "../../types/snapshot.ts";
import { labelOf, listed } from "./examples.ts";

/** A raw value Figma matches to a token, and the layers that hold it. */
interface Match {
  readonly word: string;
  readonly value: string;
  readonly token: string;
  readonly examples: string[];
}

/**
 * Raw spacing, radii, strokes and opacity Figma itself matches to one token (inferredVariables): one hint per token,
 * field word and value, with the layers that use it.
 */
export function inferredHints(snapshot: Snapshot, nodes: readonly SnapshotNode[]): string[] {
  const found = new Map<string, Match>();

  for (const node of nodes) {
    for (const [field, id] of Object.entries(node.inferred ?? {})) {
      const word = INFERRED_WORDS[field];
      const variable = snapshot.variables[id];
      const raw: unknown = node[field as keyof SnapshotNode];

      // A zero is what a layout without that padding or gap has: a hint there would only be noise.
      if (word === undefined || variable === undefined || typeof raw !== "number" || raw === 0) {
        continue;
      }

      const value = valueCss(field, word, raw);
      const token = variableTokenName(variable);
      const key = `${word}|${value}|${token}`;
      const match = found.get(key) ?? {
        word,
        value,
        token,
        examples: [],
      };

      if (!match.examples.includes(labelOf(node))) {
        match.examples.push(labelOf(node));
      }

      found.set(key, match);
    }
  }

  return [...found.values()].map(
    ({ word, value, token, examples }) =>
      `${word} ${value} on ${examples.length === 1 ? "1 layer" : `${examples.length} layers`} (${listed(examples)}) matches ${token}, Figma's own match for that field: use the token.`,
  );
}

/** A raw value as design_read writes it: an opacity bare, a border width with its fractions, other lengths whole. */
function valueCss(field: string, word: string, raw: number): string {
  if (field === "opacity") {
    return decimal(raw);
  }

  return word === "border-width" ? decimalPx(raw) : px(raw);
}

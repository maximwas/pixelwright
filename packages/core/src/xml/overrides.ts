import { OVERRIDE_NOISE, OVERRIDE_ORDER, OVERRIDE_WORDS, TEXT_OVERRIDE_WORDS } from "../constants/overrides.ts";
import type { SnapshotNode } from "../types/snapshot.ts";

/** What an instance changed on this layer outside its component's properties, in CSS words, each once, in one order. */
export function overrideWords(node: SnapshotNode): string[] {
  const words = new Set(
    (node.overrides ?? [])
      .filter((field) => !OVERRIDE_NOISE.has(field))
      .map(
        (field) => (node.type === "TEXT" ? TEXT_OVERRIDE_WORDS[field] : undefined) ?? OVERRIDE_WORDS[field] ?? field,
      ),
  );
  const rank = (word: string) => {
    const at = OVERRIDE_ORDER.indexOf(word);

    return at === -1 ? OVERRIDE_ORDER.length : at;
  };

  return [...words].sort((a, b) => rank(a) - rank(b));
}

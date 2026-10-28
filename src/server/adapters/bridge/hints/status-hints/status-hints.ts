import { inject, injectable } from "@needle-di/core";
import { STATUS_HINT_RULES } from "@/server/adapters/bridge/hints/status-hints/status-hints.tokens.ts";
import type { HintFacts } from "@/server/adapters/bridge/hints/status-hints/status-hints.types.ts";

/**
 * The status hint (S-035): what the user should do next, in words the model passes on. The rows are tried in their
 * priority order, which the root binds from STATUS_HINT_ORDER: the bridge's own trouble, then a pairing code, then the
 * pairing pause, then a connected file (no hint), then a refused connection, then "no file is connected".
 */
@injectable()
export class StatusHints {
  readonly #rules;

  constructor(rules = inject(STATUS_HINT_RULES, { multi: true })) {
    this.#rules = rules;
  }

  hint(facts: HintFacts): string | null {
    return this.#rules.find((rule) => rule.applies(facts))?.text(facts) ?? null;
  }
}

import { ACTION_NAMES, QUIET_OPERATIONS, RECENT_ACTIONS } from "../constants/plugin.ts";
import type { RequestOutcome } from "../types/link.ts";
import type { ActionLine, RecentAction } from "../types/window.ts";

/**
 * What a request did, in the window's words, from its answer; null for a step of another action (a status probe, the
 * read before a write, a file's or an export's later chunks).
 */
export function describeAction(op: string, input: unknown, outcome: RequestOutcome): ActionLine | null {
  if (QUIET_OPERATIONS.has(op) || offsetOf(input) > 0) {
    return null;
  }

  const name = ACTION_NAMES[op] ?? op;

  if (!outcome.ok) {
    const refused = outcome.error.code === "EDITS_DISABLED";

    return {
      text: refused ? "Edit refused: Allow edits is off" : `${name} — failed`,
      warning: true,
      refused,
    };
  }

  // Code that threw still answers: its error is in the result.
  if (op === "execute" && typeof (outcome.result as { error?: unknown } | null)?.error === "string") {
    return {
      text: `${name} — failed`,
      warning: true,
      refused: false,
    };
  }

  return {
    text:
      op === "apply"
        ? applied(input, outcome.result)
        : op === "delete"
          ? deleted(outcome.result)
          : op === "tokens_apply"
            ? tokensWritten(input, outcome.result)
            : name,
    warning: false,
    refused: false,
  };
}

/** The window's last actions with this one first. */
export function withAction(actions: readonly RecentAction[], action: RecentAction): readonly RecentAction[] {
  return [action, ...actions].slice(0, RECENT_ACTIONS);
}

function offsetOf(input: unknown): number {
  const offset = typeof input === "object" && input !== null ? (input as { offset?: unknown }).offset : undefined;

  return typeof offset === "number" ? offset : 0;
}

function applied(input: unknown, result: unknown): string {
  const {
    created = [],
    changed = [],
    errors = [],
  } = (result ?? {}) as {
    created?: unknown[];
    changed?: unknown[];
    errors?: unknown[];
  };
  const dryRun = typeof input === "object" && input !== null && ((input as { dryRun?: boolean }).dryRun ?? false);
  let done = "Changed nothing";

  if (dryRun) {
    done = "Checked a change";
  } else if (created.length > 0) {
    done =
      changed.length > 0
        ? `Made ${count(created.length, "layer")}, changed ${changed.length}`
        : `Made ${count(created.length, "layer")}`;
  } else if (changed.length > 0) {
    done = `Changed ${count(changed.length, "layer")}`;
  }

  return withErrors(done, errors.length);
}

function tokensWritten(input: unknown, result: unknown): string {
  const {
    created = [],
    updated = [],
    errors = [],
  } = (result ?? {}) as {
    created?: unknown[];
    updated?: unknown[];
    errors?: unknown[];
  };
  const dryRun = typeof input === "object" && input !== null && ((input as { dryRun?: boolean }).dryRun ?? false);
  let done = "Changed nothing";

  if (dryRun) {
    done = "Checked tokens";
  } else if (created.length > 0) {
    done =
      updated.length > 0
        ? `Made ${count(created.length, "token")}, changed ${updated.length}`
        : `Made ${count(created.length, "token")}`;
  } else if (updated.length > 0) {
    done = `Changed ${count(updated.length, "token")}`;
  }

  return withErrors(done, errors.length);
}

function deleted(result: unknown): string {
  const { deleted: gone = [], errors = [] } = (result ?? {}) as { deleted?: unknown[]; errors?: unknown[] };

  return withErrors(`Deleted ${count(gone.length, "layer")}`, errors.length);
}

function withErrors(text: string, errors: number): string {
  return errors === 0 ? text : `${text} (${count(errors, "error")})`;
}

function count(amount: number, noun: string): string {
  return `${amount} ${noun}${amount === 1 ? "" : "s"}`;
}

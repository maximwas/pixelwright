import {
  type BindOutput,
  BridgeError,
  type ComponentEntry,
  type DesignLint,
  designLint,
  type Snapshot,
} from "@pixelwright/core";
import type * as z from "zod";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import type { PluginSession } from "../../plugin/plugin-session.ts";
import { type Scope, scopeOf } from "../../plugin/scope.ts";
import { errorMessage } from "../../utils/error-message.ts";
import { LINT_MAX_ROOTS } from "./constants.ts";
import type { DesignLintInputSchema } from "./schemas.ts";

/** The layers a lint reads one by one, and what it left out. */
interface LintRoots {
  readonly ids: readonly string[];
  readonly notes: readonly string[];
}

/**
 * design_lint: each root read (a page's top layers for a page), tokens_bind's dry run over the same layers for the fix
 * hints, the components they use for the states rule; core checks the rules.
 */
export async function lintDesign(
  plugin: PluginClient,
  { within, rules, severity, limit, file }: z.output<typeof DesignLintInputSchema>,
): Promise<DesignLint> {
  const session = plugin.session(file);
  const scope = await scopeOf(session, within, { pageWhenEmpty: true });
  const roots = await rootsOf(session, scope);
  const reads: Snapshot[] = [];
  const notes = [...roots.notes];

  for (const id of roots.ids) {
    try {
      reads.push(
        await session.run("snapshot", {
          node: id,
          css: "none",
        }),
      );
    } catch (error) {
      notes.push(`${id} was not read: ${errorMessage(error)}`);
    }
  }

  const lint = designLint(
    {
      reads,
      bind: await bindPreview(session, roots.ids, notes),
      components: await usedComponents(session, scope),
    },
    {
      rules,
      severity,
      limit,
      scope: scope.label,
    },
  );

  return {
    ...lint,
    notes: [...notes, ...lint.notes],
  };
}

/** The layers to read: a page's top layers for each page in the scope, at most LINT_MAX_ROOTS of them. */
async function rootsOf(session: PluginSession, scope: Scope): Promise<LintRoots> {
  if (scope.pages.length === 0) {
    return {
      ids: scope.roots.slice(0, LINT_MAX_ROOTS),
      notes:
        scope.roots.length > LINT_MAX_ROOTS
          ? [`${scope.roots.length - LINT_MAX_ROOTS} more selected layers were not linted.`]
          : [],
    };
  }

  const { pages } = await session.run("file_map", null);
  const tops = pages.filter(({ id }) => scope.pages.includes(id)).flatMap((page) => page.nodes.map(({ id }) => id));
  const total = pages
    .filter(({ id }) => scope.pages.includes(id))
    .reduce((sum, page) => sum + (page.total ?? page.nodes.length), 0);
  const ids = tops.slice(0, LINT_MAX_ROOTS);

  return {
    ids,
    notes:
      total > ids.length
        ? [
            `${total - ids.length} more top layers in ${scope.label} were not linted: lint them with within, one page or frame at a time.`,
          ]
        : [],
  };
}

/** tokens_bind's dry run over the layers, for the fix hints; null when the plugin is older than the operation. */
async function bindPreview(
  session: PluginSession,
  ids: readonly string[],
  notes: string[],
): Promise<BindOutput | null> {
  if (ids.length === 0) {
    return null;
  }

  try {
    return await session.run("bind", {
      roots: [...ids],
      dryRun: true,
    });
  } catch (error) {
    if (!(error instanceof BridgeError && error.code === "UNKNOWN_OP")) {
      notes.push(`Which tokens hold the raw values could not be read: ${errorMessage(error)}`);
    }

    return null;
  }
}

/** The components the scope's instances use, for the states rule; none when they cannot be read. */
async function usedComponents(session: PluginSession, scope: Scope): Promise<ComponentEntry[]> {
  const entries = new Map<string, ComponentEntry>();
  const places = scope.label === "the file" ? [undefined] : scope.roots;

  for (const within of places) {
    try {
      const { components } = await session.run("components", {
        scope: "used",
        ...(within === undefined ? {} : { within }),
        limit: 500,
      });

      for (const entry of components) {
        entries.set(entry.id, entry);
      }
    } catch {
      // The states rule then has nothing to check: the other rules still run.
    }
  }

  return [...entries.values()];
}

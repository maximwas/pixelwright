import type { OperationResult } from "@pixelwright/core";
import type * as z from "zod";
import { sourceMissing } from "../../code-connect/code-source.ts";
import type { EnumUse } from "../../code-connect/coverage.ts";
import { RenderSession } from "../../code-connect/render-session.ts";
import type { TemplateFile } from "../../types/code-connect.ts";
import type { CodeConnectReadOutputSchema } from "./schemas.ts";
import type { TemplateUses } from "./template-uses.ts";

type Entry = z.output<typeof CodeConnectReadOutputSchema>["templates"][number];

/** A connection's entry, and the getEnum calls of its trial run, whose missing values a components read tells. */
export interface Report {
  readonly entry: Entry;
  readonly enums: readonly EnumUse[];
}

/** What a report needs: the read's connections and uses, the project root, the open file's key. */
export interface ReportSources {
  readonly templates: readonly TemplateFile[];
  readonly uses: TemplateUses;
  readonly root: string;
  readonly fileKey: string | null;
}

/**
 * Each connection with what it matched, in path order: a batch row only when it matched here, a batch file none of
 * whose rows did once by its path. The first instance a connection matched is tried: its error, or what its code left
 * out.
 */
export async function reportsOf(sources: ReportSources): Promise<Report[]> {
  const used = new Set(
    sources.templates.filter((template) => sources.uses.matched.has(template)).map(({ batchFile }) => batchFile),
  );
  const listed = new Set<string>();
  const reports: Report[] = [];

  for (const template of sources.templates) {
    if (template.batchFile === undefined || sources.uses.matched.has(template)) {
      reports.push(await reportOf(template, sources));
    } else if (!used.has(template.batchFile) && !listed.has(template.batchFile)) {
      listed.add(template.batchFile);
      reports.push({
        entry: {
          path: template.batchFile,
          matches: [],
        },
        enums: [],
      });
    }
  }

  return reports;
}

async function reportOf(template: TemplateFile, sources: ReportSources): Promise<Report> {
  const entry = sources.uses.matched.get(template);
  const session = new RenderSession(sources.templates, { fileKey: sources.fileKey });
  const trial = entry === undefined ? null : session.render(entry.first);
  const coverage = entry === undefined ? undefined : session.coverage(entry.first.id);
  const missing = await sourceMissing(sources.root, template);

  return {
    entry: {
      path: template.path,
      ...(template.url === undefined ? {} : { url: template.url }),
      ...(template.key === undefined ? {} : { key: template.key }),
      ...(template.component === undefined ? {} : { component: template.component }),
      ...(template.codeSource === undefined ? {} : { source: template.codeSource }),
      ...(missing ? { missing: true as const } : {}),
      matches: [...(entry?.counts.values() ?? [])].map(({ component, instances, by }) => ({
        component,
        instances,
        by,
      })),
      ...(trial !== null && "error" in trial ? { error: trial.error } : {}),
      ...(coverage === undefined || coverage.unread.length === 0 ? {} : { unread: coverage.unread }),
    },
    enums: coverage?.enums ?? [],
  };
}

/** The variant values each report's getEnum calls leave unmapped, from the components the read uses. */
export function withValues(reports: readonly Report[], components: OperationResult<"components"> | null): Entry[] {
  const byId = new Map((components?.components ?? []).map((component) => [component.id, component]));

  return reports.map(({ entry, enums }) => {
    const values: Record<string, string[]> = {};

    for (const { property, owner, name, mapped } of enums) {
      const missing = (byId.get(owner)?.properties[name]?.options ?? []).filter((option) => !mapped.includes(option));

      if (missing.length > 0) {
        values[property] = [...new Set([...(values[property] ?? []), ...missing])];
      }
    }

    return Object.keys(values).length === 0
      ? entry
      : {
          ...entry,
          values,
        };
  });
}

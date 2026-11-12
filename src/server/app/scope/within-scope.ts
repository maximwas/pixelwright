import { InjectionToken, injectable } from "@needle-di/core";
import { WITHIN } from "@/server/app/scope/scope.constants.ts";
import type { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { fileMapOp } from "@/shared/ops/file-map/file-map.manifest.ts";

/** A within as tools take it: an id, a list of ids, or "file". */
type Within = string | readonly string[];

/**
 * Where a tool works (S-043): the layer or page `within` names, every page for "file", else the current page. "file"
 * is resolved here, so the plugin's ops stay page-scoped (T-041), and the pages are listed unloaded (B-036).
 */
/** A layer or page a tool goes through: its id, and a page's name when the scope listed it. */
export interface ScopeRoot {
  readonly id: string;
  readonly name?: string;
}

@injectable()
export class WithinScope {
  /**
   * What a tool goes through, one op each: the ids given, the file's pages in order, or the current page; a page listed
   * with its name, so a tool can say which page it searched.
   */
  async roots(session: PluginSession, within: Within | undefined): Promise<readonly ScopeRoot[]> {
    if (within !== undefined && typeof within !== "string") {
      return within.map((id) => ({ id }));
    }

    if (within !== undefined && within !== WITHIN.file) {
      return [{ id: within }];
    }

    const { pages } = await session.run(fileMapOp, { layers: false });

    return pages.filter(({ current }) => within === WITHIN.file || current).map(({ id, name }) => ({ id, name }));
  }
}

export const WITHIN_SCOPE = new InjectionToken<WithinScope>("WithinScope");

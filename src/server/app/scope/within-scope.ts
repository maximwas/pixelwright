import { InjectionToken, injectable } from "@needle-di/core";
import { WITHIN } from "@/server/app/scope/scope.constants.ts";
import type { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { fileMapOp } from "@/shared/ops/file-map/file-map.manifest.ts";

/**
 * Where a tool works (S-043): the layer or page `within` names, every page for "file", else the current page. "file"
 * is resolved here, so the plugin's ops stay page-scoped (T-041), and the pages are listed unloaded (B-036).
 */
@injectable()
export class WithinScope {
  /** The ids a tool goes through, one op each: the one given, the file's pages in order, or the current page. */
  async roots(session: PluginSession, within: string | undefined): Promise<readonly string[]> {
    if (within !== undefined && within !== WITHIN.file) {
      return [within];
    }

    const { pages } = await session.run(fileMapOp, { layers: false });

    return pages.filter(({ current }) => within === WITHIN.file || current).map(({ id }) => id);
  }
}

export const WITHIN_SCOPE = new InjectionToken<WithinScope>("WithinScope");

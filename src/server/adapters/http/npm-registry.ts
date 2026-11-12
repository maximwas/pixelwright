import { injectable } from "@needle-di/core";
import * as zod from "zod/mini";
import type { PackageRegistry } from "@/core/ports/package-registry.port.ts";
import { NPM_LATEST } from "@/server/adapters/http/http.constants.ts";
import { NpmLatestSchema } from "@/server/adapters/http/http.schema.ts";

/** npm's newest pixelwright (S-070); any failure (offline, slow, an odd answer) is null and changes nothing. */
@injectable()
export class NpmRegistry implements PackageRegistry {
  async latest(): Promise<string | null> {
    try {
      const response = await fetch(NPM_LATEST.url, { signal: AbortSignal.timeout(NPM_LATEST.timeoutMs) });

      return response.ok ? zod.parse(NpmLatestSchema, await response.json()).version : null;
    } catch {
      return null;
    }
  }
}

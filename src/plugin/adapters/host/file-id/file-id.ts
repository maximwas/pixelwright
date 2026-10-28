import { injectable } from "@needle-di/core";
import { FILE_ID_KEY, FILE_ID_RADIX, RANDOM_DIGITS_FROM } from "@/plugin/adapters/host/file-id/file-id.constants.ts";

/**
 * The file's id for per-file state (P-011, P-013): figma.fileKey where Figma gives it, else an id written to the root's
 * plugin data the first time it is needed. Reading never writes; a copy of the file carries the id (accepted, R-003).
 */
@injectable()
export class FileId {
  read(): string | null {
    const stored = figma.root.getPluginData(FILE_ID_KEY);

    return figma.fileKey ?? (stored === "" ? null : stored);
  }

  /** The id, written first if the file has none: Date and Math.random, as main has no crypto and it is no secret. */
  ensure(): string {
    const id = this.read();

    if (id !== null) {
      return id;
    }

    const made = Date.now().toString(FILE_ID_RADIX) + Math.random().toString(FILE_ID_RADIX).slice(RANDOM_DIGITS_FROM);

    figma.root.setPluginData(FILE_ID_KEY, made);

    return made;
  }
}

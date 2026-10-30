import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname } from "node:path";
import { inject, injectable } from "@needle-di/core";
import { IMAGE_FORMAT } from "@/core/images/images.constants.ts";
import { IMAGE_SNIFFER } from "@/core/ports/image-sniffer.port.ts";
import type { PngFiles } from "@/core/ports/png-files.port.ts";
import { PNG_FILE, PNG_FILE_TEXT } from "@/server/adapters/files/files.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/**
 * Screenshots on disk (T-072): a tool that only reads Figma must not destroy a file the user keeps (D-14), so a PNG goes
 * only to a .png path, and never over a file whose bytes are not a PNG; an earlier screenshot is replaced.
 */
@injectable()
export class NodePngFiles implements PngFiles {
  readonly #sniffer;

  constructor(sniffer = inject(IMAGE_SNIFFER)) {
    this.#sniffer = sniffer;
  }

  async check(path: string): Promise<string> {
    if (extname(path).toLowerCase() !== PNG_FILE.extension) {
      throw new PixelwrightError(ERROR_CODE.opFailed, PNG_FILE_TEXT.notPngPath(path));
    }

    const existing = await readFile(path).catch(() => null);

    if (existing !== null && this.#sniffer.sniff(existing)?.format !== IMAGE_FORMAT.png) {
      throw new PixelwrightError(ERROR_CODE.opFailed, PNG_FILE_TEXT.notPngFile(path));
    }

    return path;
  }

  async write(path: string, png: Uint8Array): Promise<void> {
    await this.check(path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, png);
  }
}

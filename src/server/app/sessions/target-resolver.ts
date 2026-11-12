import { InjectionToken, injectable } from "@needle-di/core";
import { LINK_TEXT } from "@/core/ports/plugin-link.constants.ts";
import type { ConnectedFile } from "@/core/ports/plugin-link.port.ts";
import { TARGET_TEXT } from "@/server/app/sessions/sessions.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/**
 * The session a call works on (T-001): the active file when it names none, else the file named by session id or by
 * name in any case. A name two files share, or one no file has, fails with the files that are connected.
 */
@injectable()
export class TargetResolver {
  resolve(files: readonly ConnectedFile[], file: string | undefined): string {
    const [first] = files;

    if (first === undefined) {
      throw new PixelwrightError(ERROR_CODE.pluginNotConnected, LINK_TEXT.notConnected);
    }

    if (file === undefined) {
      return (files.find((connected) => connected.active) ?? first).session;
    }

    const bySession = files.find((connected) => connected.session === file);

    if (bySession !== undefined) {
      return bySession.session;
    }

    const wanted = file.trim().toLowerCase();
    const byName = files.filter((connected) => connected.name.toLowerCase() === wanted);
    const [only, second] = byName;

    if (only !== undefined && second === undefined) {
      return only.session;
    }

    throw only === undefined
      ? new PixelwrightError(
        ERROR_CODE.fileNotFound,
        TARGET_TEXT.notFound(file, files.map((connected) => connected.name).join(TARGET_TEXT.separator)),
      )
      : new PixelwrightError(
        ERROR_CODE.ambiguousFile,
        TARGET_TEXT.ambiguous(file, byName.map((connected) => connected.session).join(TARGET_TEXT.separator)),
      );
  }
}

export const TARGET_RESOLVER = new InjectionToken<TargetResolver>("TargetResolver");

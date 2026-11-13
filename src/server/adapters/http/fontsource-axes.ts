import { injectable } from "@needle-di/core";
import * as zod from "zod/mini";
import type { FontAxesDirectory, FontAxis } from "@/core/ports/font-directory.port.ts";
import { FONTSOURCE } from "@/server/adapters/http/http.constants.ts";
import { FontsourceVariableSchema } from "@/server/adapters/http/http.schema.ts";

type Axes = Readonly<Record<string, FontAxis>> | null;

/**
 * A family's axis ranges from Fontsource's variable endpoint (A§15.5): read once per family for the server; a read that
 * failed (no answer, a 429, a 5xx) is forgotten, so the next call asks again. A static family, one Fontsource lacks, or
 * no answer is none.
 */
@injectable()
export class FontsourceAxes implements FontAxesDirectory {
  readonly #read = new Map<string, Promise<Axes | undefined>>();

  async axes(family: string): Promise<Axes> {
    const asked = this.#read.get(family) ?? this.#fetch(family);

    this.#read.set(family, asked);

    const axes = await asked;

    if (axes === undefined) {
      this.#read.delete(family);
    }

    return axes ?? null;
  }

  /** The family's axes, null when Fontsource has none for it, undefined when it could not be asked. */
  async #fetch(family: string): Promise<Axes | undefined> {
    const id = family.trim().toLowerCase().replace(FONTSOURCE.idSpaces, FONTSOURCE.idSeparator);

    try {
      const response = await fetch(FONTSOURCE.variableUrl(id), { signal: AbortSignal.timeout(FONTSOURCE.timeoutMs) });

      // Only a 404 says the family is static; a 429 or a 5xx says nothing, so it is not remembered as one.
      if (!response.ok) {
        return response.status === FONTSOURCE.notFound ? null : undefined;
      }

      const { axes } = zod.parse(FontsourceVariableSchema, await response.json());

      return Object.fromEntries(
        Object.entries(axes).map(([tag, axis]) => [
          tag,
          { min: Number(axis.min), max: Number(axis.max), default: Number(axis.default) },
        ]),
      );
    } catch {
      return undefined;
    }
  }
}

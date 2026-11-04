import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { InjectionToken, inject, injectable } from "@needle-di/core";
import { writeFile } from "atomically";
import * as zod from "zod/mini";
import { PROJECT_FOLDER } from "@/server/app/project/project-folder.ts";
import { BASELINE_FILES, BASELINE_TEXT } from "@/server/app/stores/stores.constants.ts";
import { type BaselineFile, BaselineFileSchema } from "@/server/app/stores/stores.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/** Where a baseline went, and whether its folder had to be made for it. */
export interface WrittenBaseline {
  readonly path: string;
  readonly madeFolder: boolean;
}

/**
 * The project's baselines (T-200, K-058): one format 1 file per name in `<project>/.pixelwright/baselines`, written
 * whole in one rename (atomically) as compact JSON with the header first, read back through its schema. A baseline's
 * name is its file's: the name inside a file someone renamed or copied is not where it lives. The home folder and the
 * disk's root are no project (ProjectFolder). Not the JsonFile port: that writes the home's private pretty JSON and
 * reads a broken file as missing, which would let a save write over it.
 */
@injectable()
export class BaselineStore {
  readonly #project;
  /** zod/mini carries no messages of its own: English ones say what the format expected. */
  readonly #messages = zod.locales.en().localeError;

  constructor(project = inject(PROJECT_FOLDER)) {
    this.#project = project;
  }

  /** The project folder baselines live in. */
  root(): Promise<string> {
    return this.#project.root(BASELINE_TEXT.noProject);
  }

  /** One baseline, named by its file; null when the project has none of that name; an error naming an unreadable file. */
  async read(name: string): Promise<BaselineFile | null> {
    const path = await this.path(name);
    let text: string;

    try {
      text = await readFile(path, BASELINE_FILES.encoding);
    } catch (error) {
      if (this.#missing(error)) {
        return null;
      }

      throw this.#unreadable(path, error);
    }

    return { ...this.#parsed(path, text), name };
  }

  /** The project's baselines by name, in order; none before the first is kept. */
  async names(): Promise<string[]> {
    const folder = await this.#folder();
    let files: string[];

    try {
      files = await readdir(folder);
    } catch (error) {
      if (this.#missing(error)) {
        return [];
      }

      throw this.#unreadable(folder, error);
    }

    return files
      .filter((file) => file.endsWith(BASELINE_FILES.extension))
      .map((file) => file.slice(0, -BASELINE_FILES.extension.length))
      .filter((name) => BASELINE_FILES.name.test(name))
      .sort();
  }

  /** Where the baseline of a name lives, kept or not. */
  async path(name: string): Promise<string> {
    return join(await this.#folder(), BASELINE_FILES.file(name));
  }

  /** Writes a baseline whole or not at all, under its name, which no path can be. */
  async write(file: BaselineFile): Promise<WrittenBaseline> {
    if (!BASELINE_FILES.name.test(file.name)) {
      throw new PixelwrightError(ERROR_CODE.opFailed, BASELINE_TEXT.notName(file.name));
    }

    const folder = await this.#folder();
    const made = await mkdir(folder, { recursive: true });
    const path = join(folder, BASELINE_FILES.file(file.name));

    await writeFile(path, this.#text(file));

    return { path, madeFolder: made !== undefined };
  }

  async #folder(): Promise<string> {
    return join(await this.root(), BASELINE_FILES.folder);
  }

  #missing(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === BASELINE_FILES.missing;
  }

  /** The file's baseline; one a newer Pixelwright wrote is refused, not misread. */
  #parsed(path: string, text: string): BaselineFile {
    let json: unknown;

    try {
      json = JSON.parse(text);
    } catch (error) {
      throw this.#unreadable(path, error);
    }

    const format =
      typeof json === "object" && json !== null && "pixelwrightBaseline" in json ? json.pixelwrightBaseline : null;

    if (typeof format === "number" && format > BASELINE_FILES.format) {
      throw this.#unreadable(path, BASELINE_TEXT.newer);
    }

    const parsed = zod.safeParse(BaselineFileSchema, json, { error: this.#messages });

    if (!parsed.success) {
      const [issue] = parsed.error.issues;

      throw this.#unreadable(
        path,
        BASELINE_TEXT.offFormat(issue?.path.join(BASELINE_TEXT.pathSeparator) ?? "", issue?.message ?? ""),
      );
    }

    return parsed.data;
  }

  #unreadable(path: string, why: unknown): PixelwrightError {
    return new PixelwrightError(
      ERROR_CODE.opFailed,
      BASELINE_TEXT.unreadable(path, why instanceof Error ? why.message : String(why)),
    );
  }

  /** Compact JSON with a final newline: the header first, the read and its tokens after it. */
  #text(baseline: BaselineFile): string {
    const { pixelwrightBaseline, name, capturedAt, by, file, page, node, code, version, snapshot, tokens } = baseline;

    return BASELINE_FILES.text(
      JSON.stringify({ pixelwrightBaseline, name, capturedAt, by, file, page, node, code, version, snapshot, tokens }),
    );
  }
}

export const BASELINE_STORE = new InjectionToken<BaselineStore>("BaselineStore");

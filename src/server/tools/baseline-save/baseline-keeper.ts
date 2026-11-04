import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { InjectionToken, inject, injectable } from "@needle-di/core";
import { DESIGN_DIFF, type DesignDiff } from "@/core/diff/design-diff.ts";
import { BASELINE_STORE } from "@/server/app/stores/baseline-store.ts";
import type { BaselineFile } from "@/server/app/stores/stores.schema.ts";
import { BASELINE_SAVE, BASELINE_SAVE_TEXT } from "@/server/tools/baseline-save/baseline-save.constants.ts";
import type { BaselineSaveOutput } from "@/server/tools/baseline-save/baseline-save.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/** The project's files a baseline lists, as it keeps them, and a note for each one not there yet. */
export interface CodePaths {
  readonly paths: string[];
  readonly notes: string[];
}

type Replaced = NonNullable<BaselineSaveOutput["replaced"]>;

/**
 * The project's baselines as baseline_save keeps them: the project they live in, the code files they list (T-201),
 * the one a name holds, and a baseline written with what the answer says of it: its layers and tokens, the branches
 * its read did not hold whole (T-203), and with replace what the new read took in against the old one, counted as
 * nodes_diff counts layers.
 */
@injectable()
export class BaselineKeeper {
  readonly #store;
  readonly #diff;

  constructor(store = inject(BASELINE_STORE), diff: Pick<DesignDiff, "diff"> = inject(DESIGN_DIFF)) {
    this.#store = store;
    this.#diff = diff;
  }

  /** The project folder: the home folder and the disk's root are refused before the plugin is asked anything. */
  root(): Promise<string> {
    return this.#store.root();
  }

  /** The code files relative to the project with `/` between folders; one outside it refused, one not there noted. */
  code(paths: readonly string[], root: string): CodePaths {
    const notes: string[] = [];
    const checked = paths.map((given) => {
      const path = given.replaceAll(BASELINE_SAVE.backslash, BASELINE_SAVE.separator);

      if (
        isAbsolute(path) ||
        BASELINE_SAVE.drive.test(path) ||
        path.split(BASELINE_SAVE.separator).includes(BASELINE_SAVE.up)
      ) {
        throw new PixelwrightError(ERROR_CODE.opFailed, BASELINE_SAVE_TEXT.outside(given));
      }

      if (!existsSync(join(root, path))) {
        notes.push(BASELINE_SAVE_TEXT.notYet(path));
      }

      return path;
    });

    return { paths: checked, notes };
  }

  /** The baseline a name holds; with replace one that cannot be read counts as none, since it is started over. */
  async existing(name: string, replace: boolean): Promise<BaselineFile | null> {
    try {
      return await this.#store.read(name);
    } catch (error) {
      if (replace) {
        return null;
      }

      throw error;
    }
  }

  /** Writes a baseline and answers what it keeps; `replaced` is the baseline a replace starts over. */
  async write(
    baseline: BaselineFile,
    notes: readonly string[],
    replaced?: BaselineFile,
  ): Promise<BaselineSaveOutput> {
    const { path, madeFolder } = await this.#store.write(baseline);
    const { snapshot } = baseline;
    const cut = this.#cut(snapshot.root);
    const made = madeFolder ? [BASELINE_SAVE_TEXT.madeFolder(await this.#store.root())] : [];

    return {
      name: baseline.name,
      path,
      node: baseline.node,
      file: baseline.file,
      page: baseline.page,
      capturedAt: baseline.capturedAt,
      code: baseline.code,
      layers: this.#layers(snapshot.root),
      tokens: this.#tokens(baseline),
      cut,
      ...(replaced === undefined ? {} : { replaced: this.#replaced(replaced, baseline) }),
      notes: [...made, ...notes, ...(cut.length === 0 ? [] : [BASELINE_SAVE_TEXT.cut])],
    };
  }

  #replaced(before: BaselineFile, after: BaselineFile): Replaced {
    const { changed, onlyInA, onlyInB } = this.#diff.diff(before.snapshot, after.snapshot);

    return {
      node: { id: before.node.id, name: before.node.name },
      capturedAt: before.capturedAt,
      counts: { changed: changed.length, added: onlyInB.length, removed: onlyInA.length },
    };
  }

  /** The shown layers whose read lacks some of their children: the read's budget cut them there. */
  #cut(layer: ReadLayer): BaselineSaveOutput["cut"] {
    // A hidden layer is a stub: its children were never read, not cut.
    if (!layer.visible) {
      return [];
    }

    const children = layer.children ?? [];
    const own =
      children.length < layer.childCount ? [{ id: layer.id, name: layer.name, children: layer.childCount }] : [];

    return [...own, ...children.flatMap((child) => this.#cut(child))];
  }

  #layers(layer: ReadLayer): number {
    return 1 + (layer.children ?? []).reduce((sum, child) => sum + this.#layers(child), 0);
  }

  /** The variables and styles a baseline keeps values of; with no tokens read, those its read names. */
  #tokens({ tokens, snapshot }: BaselineFile): number {
    return tokens === null
      ? Object.keys(snapshot.variables).length + Object.keys(snapshot.styles).length
      : tokens.variables.length + Object.keys(tokens.external).length + tokens.styles.length;
  }
}

export const BASELINE_KEEPER = new InjectionToken<BaselineKeeper>("BaselineKeeper");

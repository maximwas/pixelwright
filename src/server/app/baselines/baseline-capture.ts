import { InjectionToken, inject, injectable } from "@needle-di/core";
import { SLUG } from "@/core/kernel/names/slug.ts";
import { CLOCK } from "@/core/ports/clock.port.ts";
import { PLUGIN_LINK } from "@/core/ports/plugin-link.port.ts";
import { VARIABLE_VALUE } from "@/core/tokens/model/model.constants.ts";
import { BASELINE_FILES, BASELINE_TEXT } from "@/server/app/baselines/baselines.constants.ts";
import type { BaselineFile } from "@/server/app/baselines/baselines.schema.ts";
import { SELECTED_LAYER } from "@/server/app/scope/selected-layer.ts";
import type { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { NODE_TEXT } from "@/shared/errors/errors.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { readOp } from "@/shared/ops/read/read.manifest.ts";
import { variablesOp } from "@/shared/ops/variables/variables.manifest.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";
import { VERSION } from "@/shared/version/version.constants.ts";

/** A layer read for a baseline: the baseline it makes (its code still to list), and what the read could not take in. */
export interface Capture {
  readonly baseline: BaselineFile;
  readonly notes: string[];
}

/** A hidden root, by its id: design_read reads no hidden layer, so nothing is kept or compared. */
export interface HiddenRoot {
  readonly hidden: string;
}

/** The tokens a read binds, or null and why not. */
interface ReadTokens {
  readonly tokens: RawTokens | null;
  readonly notes: string[];
}

/**
 * A layer read as a baseline keeps it (T-200, K-058), on the call's one session: the read op's read with vector paths
 * hashed, so a later diff tells two drawings apart, then the tokens it binds with every mode; baseline_save and
 * baseline_diff both read through it. A hidden layer comes back as hidden: design_read reads none, so no code is built
 * from it. Tokens that cannot be read leave a note, not a failure.
 */
@injectable()
export class BaselineCapture {
  readonly #selected;
  readonly #link;
  readonly #clock;
  readonly #slug;

  constructor(
    selected = inject(SELECTED_LAYER),
    link = inject(PLUGIN_LINK),
    clock = inject(CLOCK),
    slug = inject(SLUG),
  ) {
    this.#selected = selected;
    this.#link = link;
    this.#clock = clock;
    this.#slug = slug;
  }

  /** The layer (the one selected when none is given) as a baseline named `name`, else its own name as a slug. */
  async capture(
    session: PluginSession,
    node: string | undefined,
    name: string | undefined,
  ): Promise<Capture | HiddenRoot> {
    const id = node ?? (await this.#selected.id(session));
    const capturedAt = new Date(this.#clock.now()).toISOString();
    const {
      reads: [read],
    } = await session.run(readOp, { nodes: [id], pathHash: true });

    if (read === undefined) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, NODE_TEXT.notFound(id));
    }

    if (!read.root.visible) {
      return { hidden: id };
    }

    const { tokens, notes } = await this.#tokens(session, id, read);
    const connected = this.#link.files().find((file) => file.session === session.id);
    const { root } = read;

    return {
      baseline: {
        pixelwrightBaseline: BASELINE_FILES.format,
        name: name ?? this.#slug.of(root.name),
        capturedAt,
        by: { server: VERSION, plugin: connected?.pluginVersion ?? null },
        file: { name: connected?.name ?? "", key: connected?.key ?? null },
        page: read.page,
        node: { id: root.id, name: root.name, type: root.type },
        code: [],
        version: null,
        snapshot: read,
        tokens,
      },
      notes,
    };
  }

  async #tokens(
    session: PluginSession,
    id: string,
    read: ReadModel,
  ): Promise<ReadTokens> {
    try {
      const raw = await session.run(variablesOp, { libraries: false, used: true, within: id });

      return { tokens: this.#used(raw, read), notes: [] };
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error);

      return { tokens: null, notes: [BASELINE_TEXT.tokensUnread(why)] };
    }
  }

  /**
   * The tokens a baseline keeps (K-058): the variables the read's layers bind and every variable their aliases reach,
   * the collections of those with all their modes, the styles the read names, and the library variables aliases point
   * at. Only aliases count: Figma's inferred match is no token the layer uses (m:335a001e), and the file's other tokens
   * and the library catalogue the op may add are left out.
   */
  #used(raw: RawTokens, read: ReadModel): RawTokens {
    const variables = new Map(raw.variables.map((variable) => [variable.id, variable]));
    const kept = new Set<string>();
    const external = new Set<string>();
    const queue = this.#aliases(read.root);

    // The queue grows as aliases reach further: for-of reads what was pushed meanwhile.
    for (const id of queue) {
      const variable = variables.get(id);

      if (variable === undefined) {
        if (raw.external[id] !== undefined) {
          external.add(id);
        }
      } else if (!kept.has(id)) {
        kept.add(id);
        queue.push(...this.#aliases(variable.valuesByMode));
      }
    }

    const collections = new Set(raw.variables.filter(({ id }) => kept.has(id)).map(({ collectionId }) => collectionId));

    return {
      collections: raw.collections.filter(({ id }) => collections.has(id)),
      variables: raw.variables.filter(({ id }) => kept.has(id)),
      external: Object.fromEntries(Object.entries(raw.external).filter(([id]) => external.has(id))),
      styles: raw.styles.filter(({ id }) => read.styles[id] !== undefined),
      ...(raw.colorProfile === undefined ? {} : { colorProfile: raw.colorProfile }),
    };
  }

  /** The ids every alias `{ type: "VARIABLE_ALIAS", id }` in a value names, at any depth. */
  #aliases(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.flatMap((item) => this.#aliases(item));
    }

    if (typeof value !== "object" || value === null) {
      return [];
    }

    if ("type" in value && value.type === VARIABLE_VALUE.alias && "id" in value && typeof value.id === "string") {
      return [value.id];
    }

    return Object.values(value).flatMap((item) => this.#aliases(item));
  }
}

export const BASELINE_CAPTURE = new InjectionToken<BaselineCapture>("BaselineCapture");

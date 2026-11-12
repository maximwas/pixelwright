import { inject, injectable } from "@needle-di/core";
import { PROJECT_FOLDER } from "@/server/app/project/project-folder.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { COMPONENTS_READ_TEXT } from "@/server/tools/components-read/components-read.constants.ts";
import {
  type ComponentsReadInput,
  ComponentsReadInputSchema,
  type ComponentsReadOutput,
  type Listed,
} from "@/server/tools/components-read/components-read.schema.ts";
import { LINK_PATHS } from "@/server/tools/components-read/link-paths.ts";
import { componentsOp } from "@/shared/ops/components/components.manifest.ts";
import type { ComponentEntry } from "@/shared/ops/components/components.schema.ts";

/**
 * components_read (T-190): the components op's list, only the fields asked for picked here; with links (T-192), a code
 * link to a GitHub, GitLab or Bitbucket file or a vscode://file link names the project file it points at; the pages
 * Figma could not load and why links were not read go into notes.
 */
@injectable()
export class ComponentsReadTool extends Tool<ComponentsReadInput, ComponentsReadOutput> {
  protected readonly input = ComponentsReadInputSchema;
  readonly #session;
  readonly #project;
  readonly #paths;

  constructor(
    session = inject(PLUGIN_SESSION),
    project = inject(PROJECT_FOLDER),
    paths = inject(LINK_PATHS),
  ) {
    super();
    this.#session = session;
    this.#project = project;
    this.#paths = paths;
  }

  protected async run({ file, fields, ...asked }: ComponentsReadInput): Promise<ComponentsReadOutput> {
    const answer = await this.#session.run(componentsOp, asked);
    const root = asked.links ? await this.#root() : null;
    const listed = await Promise.all(answer.components.map((entry) => this.#listed(entry, root)));
    const notes = [
      ...(answer.pagesNotRead ?? []).map(({ name, error }) => COMPONENTS_READ_TEXT.pageNotRead(name, error)),
      ...(answer.linksNote === undefined ? [] : [answer.linksNote]),
    ];

    return {
      components: fields === undefined ? listed : listed.map((entry) => this.#picked(entry, fields)),
      more: answer.more,
      ...(notes.length === 0 ? {} : { notes }),
    };
  }

  /** The project folder; none for a server started in the home folder, and links then keep their urls only. */
  async #root(): Promise<string | null> {
    try {
      return await this.#project.root();
    } catch {
      return null;
    }
  }

  /** A component with the project file each of its code links points at. */
  async #listed(entry: ComponentEntry, root: string | null): Promise<Listed> {
    if (entry.links === undefined || root === null) {
      return entry;
    }

    const links = await Promise.all(
      entry.links.map(async (link) => {
        const path = await this.#paths.of(link.url, root);

        return path === undefined ? link : { ...link, path };
      }),
    );

    return { ...entry, links };
  }

  /** Only the asked fields of a component, those it has. */
  #picked(entry: Listed, fields: readonly (keyof Listed)[]): Partial<Listed> {
    return Object.fromEntries(
      fields.filter((field) => field in entry).map((field) => [field, entry[field]]),
    ) as Partial<Listed>;
  }
}

import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { CLOCK } from "@/core/ports/clock.port.ts";
import { LAYER_REFS } from "@/plugin/adapters/figma/layer-refs.ts";
import { PAGE_LOADER } from "@/plugin/adapters/figma/lookup/page-loader.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { FILE_MAP_NODE_TYPE } from "@/plugin/operations/file-map/file-map.constants.ts";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import type { fileMapOp } from "@/shared/ops/file-map/file-map.manifest.ts";
import type { MapLayer, MapPage, MapTopLayer, PageNotRead } from "@/shared/ops/file-map/file-map.schema.ts";

type FileMapInput = zod.output<typeof fileMapOp.input>;

type FileMapOutput = zod.output<typeof fileMapOp.output>;

/** The map so far: its pages, whether layers were left out, and how many more it may list. */
interface FileMapState {
  readonly pages: MapPage[];
  more: boolean;
  left: number;
}

/**
 * Every page by id and name, which needs no loading, and with `layers` its top layers and a section's own (T-034).
 * Pages load one at a time while the op has time, and at most LIMITS.fileMapNodes layers are listed in all: a page or
 * a section cut short says how many it has, and `more` that layers were left out (B-036). A page Figma cannot load is
 * listed without layers, in pagesNotRead with Figma's words. Sizes are Figma's: the server rounds them (D-15).
 */
@injectable()
export class FileMapOperation extends Operation<FileMapInput, FileMapOutput> {
  readonly #loader;
  readonly #refs;
  readonly #clock;

  constructor(
    report = inject(OP_REPORT),
    loader = inject(PAGE_LOADER),
    refs = inject(LAYER_REFS),
    clock = inject(CLOCK),
  ) {
    super(report);
    this.#loader = loader;
    this.#refs = refs;
    this.#clock = clock;
  }

  protected async execute({ layers }: FileMapInput): Promise<FileMapOutput> {
    if (!layers) {
      return { pages: this.#loader.pages().map((page) => this.#page(page)), more: false };
    }

    const deadline = this.#clock.now() + LIMITS.opBudgetMs;
    const map: FileMapState = { pages: [], more: false, left: LIMITS.fileMapNodes };
    const notRead: PageNotRead[] = [];

    for (const page of this.#loader.pages()) {
      const late = this.#clock.now() > deadline || map.left <= 0;

      if (!late && (await this.#loader.loaded(page, notRead))) {
        this.#addPage(map, page);
      } else {
        map.more ||= late;
        map.pages.push(this.#page(page));
      }
    }

    return { pages: map.pages, more: map.more, ...(notRead.length === 0 ? {} : { pagesNotRead: notRead }) };
  }

  #addPage(map: FileMapState, page: PageNode): void {
    const nodes: MapTopLayer[] = [];

    for (const node of page.children) {
      if (map.left <= 0) {
        break;
      }

      nodes.push(this.#top(map, node));
    }

    const cut = nodes.length < page.children.length;

    map.more ||= cut;
    map.pages.push({ ...this.#page(page), ...(cut ? { total: page.children.length } : {}), nodes });
  }

  /** A top layer and, for a section, its own layers while the map has room, with their number when not all fit. */
  #top(map: FileMapState, node: SceneNode): MapTopLayer {
    map.left -= 1;

    if (node.type !== FILE_MAP_NODE_TYPE.section) {
      return this.#layer(node);
    }

    const children = node.children.slice(0, Math.max(0, map.left)).map((child) => this.#layer(child));
    const cut = children.length < node.children.length;

    map.left -= children.length;
    map.more ||= cut;

    return { ...this.#layer(node), children, ...(cut ? { total: node.children.length } : {}) };
  }

  #layer(node: SceneNode): MapLayer {
    const devStatus = this.#refs.devStatus(node);

    return {
      id: node.id,
      name: node.name,
      type: node.type,
      width: node.width,
      height: node.height,
      ...(devStatus === undefined ? {} : { devStatus }),
    };
  }

  #page(page: PageNode): MapPage {
    return { id: page.id, name: page.name, current: this.#loader.current(page) };
  }
}

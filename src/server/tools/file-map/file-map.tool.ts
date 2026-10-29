import { inject, injectable } from "@needle-di/core";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { type FileMapInput, FileMapInputSchema, type FileMapOutput } from "@/server/tools/file-map/file-map.schema.ts";
import { fileMapOp } from "@/shared/ops/file-map/file-map.manifest.ts";
import type { MapLayer, MapTopLayer } from "@/shared/ops/file-map/file-map.schema.ts";

/** Every page of the call's file with its top layers (T-034), as the plugin's file_map op reads them, sizes rounded. */
@injectable()
export class FileMapTool extends Tool<FileMapInput, FileMapOutput> {
  protected readonly input = FileMapInputSchema;
  readonly #session;
  readonly #numbers;

  constructor(session = inject(PLUGIN_SESSION), numbers = inject(NUMBER_FORMAT)) {
    super();
    this.#session = session;
    this.#numbers = numbers;
  }

  protected async run(): Promise<FileMapOutput> {
    const map = await this.#session.run(fileMapOp, { layers: true });

    return {
      ...map,
      pages: map.pages.map((page) =>
        page.nodes === undefined ? page : { ...page, nodes: page.nodes.map((node) => this.#top(node)) },
      ),
    };
  }

  #top(node: MapTopLayer): MapTopLayer {
    const { children } = node;

    return {
      ...this.#sized(node),
      ...(children === undefined ? {} : { children: children.map((child) => this.#sized(child)) }),
    };
  }

  /** The layer's size in whole px (D-15). */
  #sized<Layer extends MapLayer>(layer: Layer): Layer {
    return {
      ...layer,
      width: this.#numbers.round(layer.width, PRECISION.box),
      height: this.#numbers.round(layer.height, PRECISION.box),
    };
  }
}

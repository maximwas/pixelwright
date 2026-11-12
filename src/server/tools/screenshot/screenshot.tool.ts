import { inject, injectable } from "@needle-di/core";
import { PROJECT_FOLDER } from "@/server/app/project/project-folder.ts";
import { SCREENSHOTS } from "@/server/app/renders/screenshots.ts";
import type { Shot } from "@/server/app/renders/shot.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import type { ToolAnswer } from "@/server/app/tool-runner/tool-runner.ts";
import { type ScreenshotInput, ScreenshotInputSchema } from "@/server/tools/screenshot/screenshot.schema.ts";

type ScreenshotOutput = { readonly shot: Shot };

/**
 * A layer as a PNG (T-070): inline, scaled down to fit when it must (T-071), or saved full size to a .png path that
 * holds no other file (T-072, relative to the project folder); a clip is a region of it (T-073). A bad save path is
 * said before anything renders.
 */
@injectable()
export class ScreenshotTool extends Tool<ScreenshotInput, ScreenshotOutput> {
  protected readonly input = ScreenshotInputSchema;
  readonly #session;
  readonly #folder;
  readonly #shots;

  constructor(
    session = inject(PLUGIN_SESSION),
    folder = inject(PROJECT_FOLDER),
    shots = inject(SCREENSHOTS),
  ) {
    super();
    this.#session = session;
    this.#folder = folder;
    this.#shots = shots;
  }

  protected async run({ node, scale, effects, clip, save }: ScreenshotInput): Promise<ScreenshotOutput> {
    const path = save === undefined ? undefined : await this.#shots.checked(await this.#folder.resolve(save));

    return { shot: await this.#shots.take(this.#session, { node, scale, effects, clip, save: path }) };
  }

  /** The image and its line, or the saved file's line; no structuredContent (T-005). */
  protected override answer({ shot }: ScreenshotOutput): ToolAnswer {
    return { content: shot.blocks() };
  }
}

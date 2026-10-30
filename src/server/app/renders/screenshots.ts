import { InjectionToken, inject, injectable } from "@needle-di/core";
import { PNG_FILES } from "@/core/ports/png-files.port.ts";
import { PNG_RENDER, type RenderSpec } from "@/server/app/renders/png-render.ts";
import { RENDER_TO_FIT } from "@/server/app/renders/render-to-fit.ts";
import { Shot } from "@/server/app/renders/shot.ts";
import type { PluginSession } from "@/server/app/sessions/plugin-session.ts";

/** A screenshot to take: a layer rendered, cut to a clip when given, written to `save` (an absolute path) when given. */
export interface ShotSpec extends RenderSpec {
  readonly save?: string | undefined;
}

/**
 * The screenshot tool's engine, and design_read's (T-070, T-056): saved full size to a PNG file when `save` names one
 * (T-072), else returned inline, fitted to the limits (RenderToFit, T-071).
 */
@injectable()
export class Screenshots {
  readonly #fit;
  readonly #render;
  readonly #files;

  constructor(
    fit = inject(RENDER_TO_FIT),
    render = inject(PNG_RENDER),
    files = inject(PNG_FILES),
  ) {
    this.#fit = fit;
    this.#render = render;
    this.#files = files;
  }

  /** The save path, once a PNG may go there: a bad path is said before anything renders. */
  checked(path: string): Promise<string> {
    return this.#files.check(path);
  }

  async take(session: PluginSession, { save, ...spec }: ShotSpec): Promise<Shot> {
    if (save === undefined) {
      const { png, text } = await this.#fit.inline(session, spec);

      return new Shot(png, text);
    }

    const { png, width, height } = await this.#render.render(session, spec);

    await this.#files.write(save, png);

    const clip = spec.clip === undefined ? {} : { clip: spec.clip };

    return new Shot(null, JSON.stringify({ node: spec.node, ...clip, path: save, width, height, bytes: png.length }));
  }
}

export const SCREENSHOTS = new InjectionToken<Screenshots>("Screenshots");

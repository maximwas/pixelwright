import { randomUUID } from "node:crypto";
import { InjectionToken, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { RENDERS, RENDERS_TEXT } from "@/server/app/renders/renders.constants.ts";
import type { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { chunkOp } from "@/shared/ops/chunk/chunk.manifest.ts";
import { exportOp } from "@/shared/ops/export/export.manifest.ts";

/** A layer to render: what the export op takes but the stream, which each export gets its own of. */
export type ExportRequest = Omit<zod.output<typeof exportOp.input>, "stream">;

/** An export the plugin has rendered and holds: its stream, the scale it rendered at and its size, not read yet. */
export interface HeldExport {
  readonly node: string;
  readonly stream: string;
  readonly scale: number;
  readonly totalBytes: number;
}

/** A layer's bytes and the scale they were rendered at. */
export interface Rendered {
  readonly bytes: Uint8Array;
  readonly scale: number;
}

/**
 * Exports through the bridge (T-075, S-006): the plugin renders under a random stream id, so exports read at the same
 * time never share a render, and the bytes come in 2 MiB chunks, each fitting one frame. A total that changes between
 * chunks, or an empty chunk, is an error.
 */
@injectable()
export class ExportPull {
  /** Renders the layer in the plugin, which holds the bytes: their count says whether to read them (RenderToFit). */
  async start(session: PluginSession, request: ExportRequest): Promise<HeldExport> {
    const stream = randomUUID();
    const { scale, totalBytes } = await session.run(exportOp, { ...request, stream });

    return { node: request.node, stream, scale, totalBytes };
  }

  /** A held export's bytes, chunk after chunk. */
  async bytes(session: PluginSession, held: HeldExport): Promise<Uint8Array> {
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (received < held.totalBytes) {
      // One chunk at a time: each is a frame of its own, and the next starts where this one ended.
      const answer = await session.run(chunkOp, {
        stream: held.stream,
        offset: received,
        length: LIMITS.exportChunkBytes,
      });
      const bytes = Buffer.from(answer.bytes, RENDERS.encoding);

      if (answer.totalBytes !== held.totalBytes) {
        throw new PixelwrightError(ERROR_CODE.opFailed, RENDERS_TEXT.changed(held.node));
      }

      if (bytes.length === 0) {
        throw new PixelwrightError(ERROR_CODE.opFailed, RENDERS_TEXT.empty(held.node));
      }

      chunks.push(bytes);
      received += bytes.length;
    }

    return Buffer.concat(chunks, received);
  }

  /** A layer rendered and read whole. */
  async render(session: PluginSession, request: ExportRequest): Promise<Rendered> {
    const held = await this.start(session, request);

    return { bytes: await this.bytes(session, held), scale: held.scale };
  }
}

export const EXPORT_PULL = new InjectionToken<ExportPull>("ExportPull");

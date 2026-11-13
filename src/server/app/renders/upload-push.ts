import { randomUUID } from "node:crypto";
import { InjectionToken, injectable } from "@needle-di/core";
import { RENDERS } from "@/server/app/renders/renders.constants.ts";
import type { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { UPLOAD } from "@/shared/ops/upload/upload.constants.ts";
import { uploadOp } from "@/shared/ops/upload/upload.manifest.ts";

/**
 * A file's bytes to the plugin before the apply that uses them (T-131, P-030), the mirror of ExportPull: under a fresh
 * stream id, so the files of calls side by side never mix, in 2 MiB chunks, each fitting one frame.
 */
@injectable()
export class UploadPush {
  /** The stream the plugin holds the bytes under. */
  async push(session: PluginSession, bytes: Uint8Array): Promise<string> {
    const stream = randomUUID();

    for (let offset = 0; offset < bytes.length; offset += UPLOAD.chunkBytes) {
      // One chunk at a time: each is a frame of its own.
      const chunk = Buffer.from(bytes.subarray(offset, offset + UPLOAD.chunkBytes)).toString(RENDERS.encoding);

      await session.run(uploadOp, { stream, offset, chunk, total: bytes.length });
    }

    return stream;
  }
}

export const UPLOAD_PUSH = new InjectionToken<UploadPush>("UploadPush");

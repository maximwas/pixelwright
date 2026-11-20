import { LIMITS } from "@/shared/limits/limits.constants.ts";

const MIB = 1024 * 1024;

/** A file design_apply sends the plugin (T-131, P-030). */
export const UPLOAD = {
  /** 0.7.0's UPLOAD_MAX_BYTES: an image past it is refused before a byte is sent. */
  maxBytes: 32 * MIB,
  /** One chunk: base64 makes it a third bigger, and it must fit a frame, as an export's does. */
  chunkBytes: LIMITS.exportChunkBytes,
} as const;

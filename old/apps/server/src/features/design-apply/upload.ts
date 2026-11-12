import { randomUUID } from "node:crypto";
import type { PluginSession } from "../../plugin/plugin-session.ts";

/** Sends a file's bytes to the plugin in chunks, one after another, under a fresh stream id it returns. */
export async function uploadFile(session: PluginSession, bytes: Buffer, chunkBytes: number): Promise<string> {
  const stream = randomUUID();

  for (let offset = 0; offset < bytes.length; offset += chunkBytes) {
    await session.run("upload", {
      stream,
      offset,
      chunk: bytes.subarray(offset, offset + chunkBytes).toString("base64"),
      total: bytes.length,
    });
  }

  return stream;
}

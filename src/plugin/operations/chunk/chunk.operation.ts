import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { FIGMA_BASE64 } from "@/plugin/adapters/figma/figma-base64.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { CHUNK_STREAMS } from "@/plugin/app/streams/chunk-streams.ts";
import type { chunkOp } from "@/shared/ops/chunk/chunk.manifest.ts";

type ChunkInput = zod.output<typeof chunkOp.input>;
type ChunkOutput = zod.output<typeof chunkOp.output>;

/** A part of a held export as base64 (T-075): the server pulls a render in 2 MiB parts, each fitting one frame. */
@injectable()
export class ChunkOperation extends Operation<ChunkInput, ChunkOutput> {
  readonly #streams;
  readonly #base64;

  constructor(
    report = inject(OP_REPORT),
    streams = inject(CHUNK_STREAMS),
    base64 = inject(FIGMA_BASE64),
  ) {
    super(report);
    this.#streams = streams;
    this.#base64 = base64;
  }

  protected execute({ stream, offset, length }: ChunkInput): Promise<ChunkOutput> {
    const { totalBytes, bytes } = this.#streams.chunk(stream, offset, length);

    return Promise.resolve({ totalBytes, bytes: this.#base64.encode(bytes) });
  }
}

import { InjectionToken, inject, injectable } from "@needle-di/core";
import { LAYER_WALK } from "@/plugin/adapters/figma/lookup/layer-walk.ts";
import { UPLOAD_STORE } from "@/plugin/app/streams/upload-store.ts";
import { TOKEN_INDEX } from "@/plugin/operations/apply/token-index.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";
import { INTENT_PAINT } from "@/shared/write-intents/write-intent.constants.ts";

/**
 * One apply call's start and end in the plugin: the file's tokens read again within the op's budget (the file may
 * have changed since the last call), and the files the server uploaded for it dropped once it is done, refused or not
 * (P-140, P-030; 0.7.0's apply-changes), so none waits out the store's five minutes.
 */
@injectable()
export class CallScope {
  readonly #tokens;
  readonly #walk;
  readonly #uploads;

  constructor(
    tokens = inject(TOKEN_INDEX),
    walk = inject(LAYER_WALK),
    uploads = inject(UPLOAD_STORE),
  ) {
    this.#tokens = tokens;
    this.#walk = walk;
    this.#uploads = uploads;
  }

  async around<Output>(changes: readonly ApplyChangeData[], call: () => Promise<Output>): Promise<Output> {
    this.#tokens.start(this.#walk.deadline());

    try {
      return await call();
    } finally {
      for (const stream of this.#streams(changes)) {
        this.#uploads.drop(stream);
      }
    }
  }

  /** The upload streams the changes name: an Image's or Icon's file, and the image paints of fills, strokes and text. */
  #streams(changes: readonly ApplyChangeData[]): string[] {
    return changes.flatMap(({ props }) => [
      ...(props.asset?.stream === undefined ? [] : [props.asset.stream]),
      ...[...(props.fills ?? []), ...(props.strokes?.paints ?? []), ...(props.textFills ?? [])].flatMap((paint) =>
        paint.kind === INTENT_PAINT.image && paint.stream !== undefined ? [paint.stream] : [],
      ),
    ]);
  }
}

export const CALL_SCOPE = new InjectionToken<CallScope>("CallScope");

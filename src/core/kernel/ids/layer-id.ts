/** A Figma layer id: 54:243, or an instance's layer I54:268;54:211 (C-167). */
const LAYER_ID = /^I?\d+:\d+(?:;\d+:\d+)*$/;

export class LayerId {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /** The id when `text` is written like one, else null. */
  static parse(text: string): LayerId | null {
    return LAYER_ID.test(text) ? new LayerId(text) : null;
  }
}

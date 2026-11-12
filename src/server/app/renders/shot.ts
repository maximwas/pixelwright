import { RENDERS } from "@/server/app/renders/renders.constants.ts";
import { TOOL_CONTENT_TYPE, TOOL_IMAGE } from "@/server/app/tool-runner/tool-content.constants.ts";
import type { ToolContent } from "@/server/app/tool-runner/tool-runner.ts";

/** A screenshot as a tool answers it (T-005): the PNG when it goes inline, and the line that says what it is. */
export class Shot {
  readonly png: Uint8Array | null;
  readonly text: string;

  constructor(png: Uint8Array | null, text: string) {
    this.png = png;
    this.text = text;
  }

  /** The image block, then its line; a saved screenshot is its line alone. */
  blocks(): ToolContent[] {
    const line = { type: TOOL_CONTENT_TYPE.text, text: this.text };

    if (this.png === null) {
      return [line];
    }

    const data = Buffer.from(this.png).toString(RENDERS.encoding);

    return [{ type: TOOL_CONTENT_TYPE.image, data, mimeType: TOOL_IMAGE.png }, line];
  }
}

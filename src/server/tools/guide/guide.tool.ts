import { injectable } from "@needle-di/core";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { GUIDE_INDEX, GUIDE_TOPIC_ABOUT } from "@/server/tools/guide/guide.constants.ts";
import {
  type GuideInput,
  GuideInputSchema,
  type GuideOutput,
  type GuideTopic,
} from "@/server/tools/guide/guide.schema.ts";
import assets from "@/server/tools/guide/topics/assets.md";
import tokens from "@/server/tools/guide/topics/tokens.md";
import workflow from "@/server/tools/guide/topics/workflow.md";
import xml from "@/server/tools/guide/topics/xml.md";

/**
 * How to work with Pixelwright (T-210): without a topic, the topics with their one line; with one, its Markdown. The
 * topics are `topics/<name>.md`, inlined as text by tsdown's loader (vitest.config.ts turns them into the same
 * string). It reads no file, so it needs no plugin.
 */
@injectable()
export class GuideTool extends Tool<GuideInput, GuideOutput> {
  protected readonly input = GuideInputSchema;
  readonly #markdown: Readonly<Record<GuideTopic, string>> = { workflow, xml, tokens, assets };

  protected async run({ topic }: GuideInput): Promise<GuideOutput> {
    if (topic !== undefined) {
      return { topic, markdown: this.#markdown[topic] };
    }

    const topics = Object.entries(GUIDE_TOPIC_ABOUT).map(([name, about]) => ({ name, about }));

    return { topic: GUIDE_INDEX.topic, markdown: GUIDE_INDEX.markdown(topics), topics };
  }
}

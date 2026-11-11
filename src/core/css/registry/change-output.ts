import type { WriteOutput, WriteProblem } from "@/core/css/css.types.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** Where one element's write puts its Figma properties, the attribute each came from, and its problems. */
export class ChangeOutput implements WriteOutput {
  readonly props: FigmaProps = {};
  readonly sources: Partial<Record<keyof FigmaProps, string>> = {};
  readonly problems: WriteProblem[] = [];

  set<Key extends keyof FigmaProps>(
    key: Key,
    value: Exclude<FigmaProps[Key], undefined>,
    attribute: string,
  ): void {
    this.props[key] = value;
    this.sources[key] = attribute;
  }

  fail(
    attribute: string,
    message: string,
    hint?: string,
  ): void {
    this.problems.push({ attribute, message, ...(hint === undefined ? {} : { hint }) });
  }
}

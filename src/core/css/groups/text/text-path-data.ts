import { InjectionToken, injectable } from "@needle-di/core";
import { parsePathString, roundPath } from "svg-path-commander/util";
import { TEXT_NUMBER, TEXT_TEXT, TEXT_VALUE } from "@/core/css/groups/text/text.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/** A text on a path as design_read says it (T-140, read): the path it runs along as `d`, where its text starts. */
@injectable()
export class TextPathData {
  /** Figma's vector paths as one SVG path, two decimals, each command and number apart; the start as `segment place`. */
  read({ vectorPaths, textPathStartData }: NonNullable<ReadLayer["textPath"]>): { d: string; start: string } {
    const path = roundPath(
      parsePathString(vectorPaths.map(({ data }) => data).join(TEXT_VALUE.space)),
      TEXT_NUMBER.pathPlaces,
    );

    return {
      d: path.map((segment) => segment.join(TEXT_VALUE.space)).join(TEXT_VALUE.space),
      start: TEXT_TEXT.start(textPathStartData.segment, textPathStartData.position),
    };
  }
}

export const TEXT_PATH_DATA = new InjectionToken<TextPathData>("TextPathData");

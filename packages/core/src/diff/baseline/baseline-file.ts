import { BASELINE_FORMAT, type BaselineFile, BaselineFileSchema } from "./schemas.ts";

/** A baseline file's content, checked; one written by a newer Pixelwright is refused, not misread. */
export function baselineFileOf(json: unknown): BaselineFile {
  const format =
    typeof json === "object" && json !== null && "pixelwrightBaseline" in json ? json.pixelwrightBaseline : null;

  if (typeof format === "number" && format > BASELINE_FORMAT) {
    throw new Error("saved by a newer Pixelwright: update it");
  }

  return BaselineFileSchema.parse(json);
}

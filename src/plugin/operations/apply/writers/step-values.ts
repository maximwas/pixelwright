import { InjectionToken, injectable } from "@needle-di/core";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { WRITERS_TEXT } from "@/plugin/operations/apply/writers/writers.constants.ts";

type LengthValue = number | { readonly token: string };

/** A step's values as Figma takes them: a length in pixels. */
@injectable()
export class StepValues {
  // shortcut: a token is refused here; the paint and token item binds it to its variable.
  number(value: LengthValue | undefined): number | undefined {
    if (value === undefined || typeof value === "number") {
      return value;
    }

    throw new WriteError(WRITERS_TEXT.token(value.token));
  }
}

export const STEP_VALUES = new InjectionToken<StepValues>("StepValues");

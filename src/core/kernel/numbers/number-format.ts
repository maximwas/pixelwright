import { InjectionToken, injectable } from "@needle-di/core";
import type { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";

/** The places one class of value keeps: a value of the D-15 table, not a number picked at the call. */
type Places = (typeof PRECISION)[keyof typeof PRECISION];

/** Numbers as every reader writes them (D-15, C-011): to the places their class keeps, away from float noise. */
@injectable()
export class NumberFormat {
  /** The value to `places` decimals, never -0. */
  round(value: number, places: Places): number {
    const scale = 10 ** places;

    // + 0 turns -0 into 0.
    return Math.round(value * scale) / scale + 0;
  }
}

export const NUMBER_FORMAT = new InjectionToken<NumberFormat>("NumberFormat");

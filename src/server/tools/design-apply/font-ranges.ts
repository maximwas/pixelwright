import { InjectionToken, inject, injectable } from "@needle-di/core";
import type { ApplyChange } from "@/core/apply/apply.types.ts";
import type { CurrentLayers } from "@/core/apply/plan/current-layers.ts";
import { FONT_AXES } from "@/core/ports/font-directory.port.ts";
import { NEW_TEXT_FAMILY } from "@/server/tools/design-apply/design-apply.constants.ts";
import type { FontAxes } from "@/shared/ops/apply/apply.schema.ts";

/**
 * The axis ranges a call's font-variation-settings are checked against (Plugin API 138 names a family's axes, not
 * their ranges): asked of the catalogue only for the families those changes go over (their font, else the text's runs
 * now, else a new text's Inter); a family the catalogue does not know is checked by its axes alone.
 */
@injectable()
export class FontRanges {
  readonly #axes;

  constructor(axes = inject(FONT_AXES)) {
    this.#axes = axes;
  }

  async of(changes: readonly ApplyChange[], layers: CurrentLayers): Promise<FontAxes> {
    const families = [...new Set(changes.flatMap((change) => this.#families(change, layers)))];
    const ranges: FontAxes = {};

    for (const family of families) {
      const axes = await this.#axes.axes(family);

      if (axes !== null) {
        ranges[family] = Object.fromEntries(Object.entries(axes).map(([tag, { min, max }]) => [tag, { min, max }]));
      }
    }

    return ranges;
  }

  #families(change: ApplyChange, layers: CurrentLayers): string[] {
    const parts = [change.props, ...(change.text?.runs ?? []).map(({ props }) => props)];

    if (parts.every(({ fontVariations }) => fontVariations === undefined)) {
      return [];
    }

    const fonts = parts.flatMap(({ font }) => (font === undefined ? [] : [font.family]));
    const layer = change.id === null ? undefined : layers.entry(change.id)?.layer;
    const now = (layer?.text?.segments ?? []).map(({ fontName }) => fontName.family);

    return [...fonts, ...(now.length === 0 && change.id === null ? [NEW_TEXT_FAMILY] : now)];
  }
}

export const FONT_RANGES = new InjectionToken<FontRanges>("FontRanges");

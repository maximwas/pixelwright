import { InjectionToken, inject, injectable } from "@needle-di/core";
import type { ApplyChange } from "@/core/apply/apply.types.ts";
import type { CurrentLayers } from "@/core/apply/plan/current-layers.ts";
import { FONT_AXES } from "@/core/ports/font-directory.port.ts";
import { LOG_COMPONENT } from "@/core/ports/logger.constants.ts";
import { LOGGER } from "@/core/ports/logger.port.ts";
import { FONT_RANGES_LOG, NEW_TEXT_FAMILY } from "@/server/tools/design-apply/design-apply.constants.ts";
import { APPLY } from "@/shared/ops/apply/apply.constants.ts";
import type { FontAxes } from "@/shared/ops/apply/apply.schema.ts";

/**
 * The axis ranges a call's font-variation-settings are checked against (Plugin API 138 names a family's axes, not
 * their ranges): asked of the catalogue only for the families those changes go over (their font, else the text's runs
 * now, else a new text's Inter), all at once; a family the catalogue does not know, or any family of a call over the
 * cap of families, is checked by its axes alone.
 */
@injectable()
export class FontRanges {
  readonly #axes;
  readonly #logger;

  constructor(axes = inject(FONT_AXES), logger = inject(LOGGER)) {
    this.#axes = axes;
    this.#logger = logger;
  }

  async of(changes: readonly ApplyChange[], layers: CurrentLayers): Promise<FontAxes> {
    const families = [...new Set(changes.flatMap((change) => this.#families(change, layers)))];

    if (families.length > APPLY.fontFamilies) {
      this.#logger.warn(FONT_RANGES_LOG.skipped, { component: LOG_COMPONENT.server, families: families.length });

      return {};
    }

    const found = await Promise.all(families.map(async (family) => [family, await this.#axes.axes(family)] as const));

    return Object.fromEntries(
      found.flatMap(([family, axes]) =>
        axes === null
          ? []
          : [[family, Object.fromEntries(Object.entries(axes).map(([tag, { min, max }]) => [tag, { min, max }]))]],
      ),
    );
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

import { InjectionToken, inject, injectable } from "@needle-di/core";
import {
  LINT_CONTAINERS,
  LINT_FIGMA,
  LINT_FIX,
  LINT_LIMITS,
  LINT_RULE,
  LINT_TEXT,
} from "@/core/checks/lint/lint.constants.ts";
import type { LintRuleId } from "@/core/checks/lint/lint.schema.ts";
import type { LintLayer, RuleCheck, RuleFinding, RuleSet } from "@/core/checks/lint/lint.types.ts";
import { LAYOUT_GUESS } from "@/core/design/hints/layout-guess.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { ReadLayers } from "@/shared/read-model/read-layers.ts";

/** A layer's box, in the read's coordinates. */
interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The rules on how layers are laid out: stacks placed by hand that Figma reads as a flow (K-037), and layers reaching
 * past the room their parent gives them (K-038).
 */
@injectable()
export class LayoutRules implements RuleSet {
  readonly #readLayers = new ReadLayers();
  readonly #guess;
  readonly #format;

  constructor(guess = inject(LAYOUT_GUESS), format = inject(NUMBER_FORMAT)) {
    this.#guess = guess;
    this.#format = format;
  }

  checks(): Partial<Record<LintRuleId, RuleCheck>> {
    return {
      [LINT_RULE.noAutoLayout]: (layer) => this.#noAutoLayout(layer),
      [LINT_RULE.overflow]: (layer) => this.#overflow(layer),
    };
  }

  /** A frame placing two children or more by hand that Figma's inferred layout reads as a row or a column. */
  #noAutoLayout({ layer, inInstance }: LintLayer): RuleFinding[] {
    const children = this.#readLayers.visibleChildren(layer).length;
    const guess = layer.inferredLayout;

    if (inInstance || !(LINT_CONTAINERS[layer.type] ?? false) || this.#flows(layer) || guess === undefined) {
      return [];
    }

    return children < 2
      ? []
      : [
        {
          id: layer.id,
          name: layer.name,
          message: LINT_TEXT.byHand(children, this.#guess.css(guess, children)),
          fix: LINT_FIX.autoLayout,
        },
      ];
  }

  /** A layer wider or taller than the room its parent gives it, or a grid child reaching over a sibling's cell. */
  #overflow({ layer, parent }: LintLayer): RuleFinding[] {
    if (parent === null || Math.abs(layer.rotation ?? 0) >= LINT_LIMITS.turned) {
      return [];
    }

    const other = this.#overlapped(layer, parent);

    if (other !== undefined) {
      return [{ id: layer.id, name: layer.name, message: LINT_TEXT.cell(other.id, other.name), fix: LINT_FIX.cell }];
    }

    const room = layer.text?.textTruncation === LINT_FIGMA.ending ? null : this.#room(parent, layer);
    const past = room === null ? null : this.#past(layer, room);

    if (past === null || (past.x <= LINT_LIMITS.slack && past.y <= LINT_LIMITS.slack)) {
      return [];
    }

    const reach = past.x > LINT_LIMITS.slack ? LINT_TEXT.wider(this.#px(past.x)) : LINT_TEXT.taller(this.#px(past.y));

    return [
      {
        id: layer.id,
        name: layer.name,
        message: LINT_TEXT.past(reach, parent, parent.clipsContent ?? false),
        fix: layer.type === LINT_FIGMA.text ? LINT_FIX.text : LINT_FIX.layer,
      },
    ];
  }

  /**
   * The room a parent gives a child in its flow or grid (its box less its padding); a clipping frame's own box. What a
   * clipping frame cuts is cut on purpose (a ticker, a carousel): only a text cut that way is lost content.
   */
  #room(parent: ReadLayer, child: ReadLayer): Box | null {
    if ((parent.clipsContent ?? false) && child.type !== LINT_FIGMA.text) {
      return null;
    }

    if (this.#flows(parent) && child.layoutPositioning !== LINT_FIGMA.absolute) {
      const left = parent.paddingLeft ?? 0;
      const top = parent.paddingTop ?? 0;

      return {
        x: parent.x + left,
        y: parent.y + top,
        width: parent.width - left - (parent.paddingRight ?? 0),
        height: parent.height - top - (parent.paddingBottom ?? 0),
      };
    }

    return (parent.clipsContent ?? false) ? parent : null;
  }

  /** How far a box reaches past another on each axis. */
  #past(box: Box, room: Box): { x: number; y: number } {
    return {
      x: Math.max(0, room.x - box.x) + Math.max(0, box.x + box.width - (room.x + room.width)),
      y: Math.max(0, room.y - box.y) + Math.max(0, box.y + box.height - (room.y + room.height)),
    };
  }

  /** A grid child its own box overlaps: in a grid, children meet only when one reaches out of its cell. */
  #overlapped(layer: ReadLayer, parent: ReadLayer): ReadLayer | undefined {
    if (parent.layoutMode !== LINT_FIGMA.grid || layer.layoutPositioning === LINT_FIGMA.absolute) {
      return undefined;
    }

    const meet = (
      start: number,
      size: number,
      otherStart: number,
      otherSize: number,
    ) =>
      Math.min(start + size, otherStart + otherSize) - Math.max(start, otherStart) > LINT_LIMITS.slack;

    return this.#readLayers
      .visibleChildren(parent)
      .find(
        (other) =>
          other !== layer &&
          other.layoutPositioning !== LINT_FIGMA.absolute &&
          meet(layer.x, layer.width, other.x, other.width) &&
          meet(layer.y, layer.height, other.y, other.height),
      );
  }

  #flows(layer: ReadLayer): boolean {
    return layer.layoutMode !== undefined && layer.layoutMode !== LINT_FIGMA.none;
  }

  #px(value: number): string {
    return LINT_TEXT.px(this.#format.round(value, PRECISION.spacing));
  }
}

export const LAYOUT_RULES = new InjectionToken<LayoutRules>("LayoutRules");

import { InjectionToken, inject, injectable } from "@needle-di/core";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import {
  BIND_DECISION,
  BIND_FIELD,
  BIND_SCOPE,
  BIND_TEXT,
  BIND_VALUE,
  STYLE_TYPE,
  TYPE_WORDS,
} from "@/core/tokens/bind/bind.constants.ts";
import type {
  BindCandidate,
  BindChoice,
  BindDecision,
  BindPlanned,
  BindRemap,
  BindRequest,
  BindScope,
  BindUse,
  RemapPair,
} from "@/core/tokens/bind/bind.types.ts";
import { BindChoices } from "@/core/tokens/bind/bind-choices.ts";
import { BIND_FIELDS } from "@/core/tokens/bind/bind-fields.ts";
import { BindIndex } from "@/core/tokens/bind/bind-index.ts";
import { BindReport } from "@/core/tokens/bind/bind-report.ts";
import { BIND_VALUES } from "@/core/tokens/bind/bind-values.ts";
import { BIND_KIND, BIND_PAINT_AT, BIND_SOURCE } from "@/shared/ops/bind/bind.constants.ts";
import type { BindScan, ScannedLayer } from "@/shared/ops/bind/bind.schema.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";

/**
 * tokens_bind's plan (T-167, K-026..K-029): the scan's raw values set against the file's tokens and the library
 * variables Figma infers for them (P-164). A value one token holds exactly, as design_read prints it, in the layer's
 * modes and within the token's scopes, is bound; several are listed for a pick (choose), none unmatched (for
 * tokens_apply); a pick of a token that does not hold the value snaps it. With remaps the raw values are left alone
 * and each layer's uses of a `from` token are counted for its `to`. Besides the answer, every bound use and rebind is
 * planned where it is, for the writer.
 */
@injectable()
export class TokensBind {
  readonly #values;
  readonly #fields;
  readonly #names;

  constructor(
    values = inject(BIND_VALUES),
    fields = inject(BIND_FIELDS),
    names = inject(TOKEN_NAMES),
  ) {
    this.#values = values;
    this.#fields = fields;
    this.#names = names;
  }

  /** The file's tokens by the values they hold, for one call. */
  index(raw: RawTokens): BindIndex {
    return new BindIndex(raw, this.#values, this.#fields, this.#names);
  }

  plan(
    index: BindIndex,
    scan: BindScan,
    { choose, remap }: BindRequest,
  ): BindPlanned {
    const report = new BindReport();
    const remaps = remap.length > 0;

    if (remaps) {
      this.#remap(index, scan, remap, report);
    } else {
      this.#bind(index, scan, choose, report);
    }

    if (scan.instances > 0) {
      report.note(BIND_TEXT.instances(scan.instances, remaps));
    }

    if (scan.defaults > 0) {
      report.note(BIND_TEXT.defaults(scan.defaults));
    }

    if (index.usedCut) {
      report.note(BIND_TEXT.usedCut);
    }

    return report.planned(scan.cut);
  }

  #bind(
    index: BindIndex,
    scan: BindScan,
    choose: readonly BindChoice[],
    report: BindReport,
  ): void {
    const choices = new BindChoices(choose, index);

    for (const layer of scan.layers) {
      for (const use of [
        ...this.#colors(index, layer, scan.variables),
        ...this.#numbers(index, layer, scan.variables),
        ...this.#styled(index, layer),
      ]) {
        report.add(use, this.#fonted(layer, use, choices.decide(use)));
      }
    }
  }

  /**
   * A bound use that loads the text's fonts (its text style, a run's colour) is refused where Figma lacks one of them:
   * the writer could not load it, so the dry run says so too.
   */
  #fonted(
    layer: ScannedLayer,
    use: BindUse,
    decision: BindDecision,
  ): BindDecision {
    const { place } = use;
    const fonts = place.kind === BIND_KIND.text || (place.kind === BIND_KIND.color && place.at === BIND_PAINT_AT.run);

    return layer.missingFont !== undefined && fonts && decision.kind === BIND_DECISION.bound
      ? { kind: BIND_DECISION.refused, message: BIND_TEXT.missingFont }
      : decision;
  }

  /**
   * A layer's raw solid colours with the tokens holding them: with the paint's opacity, else (see-through, none exact)
   * the opaque colour variables of its colour, which the paint keeps its opacity over (a design's `black 10%`).
   */
  #colors(
    index: BindIndex,
    layer: ScannedLayer,
    variables: BindScan["variables"],
  ): BindUse[] {
    return layer.paints.map(({ at, index: position, range, color, opacity, stylable, inferred = [] }) => {
      const stroke = at === BIND_PAINT_AT.strokes;
      const scope = stroke ? BIND_SCOPE.strokeColor : this.#fields.fillScope(layer.type);
      const value = this.#values.color(color, opacity, index.space);
      const exact = index.colors(value, { scope, modes: layer.modes, stylable });
      const opaque =
        exact.length > 0 || opacity >= 1
          ? []
          : index.colors(this.#values.color(color, 1, index.space), { scope, modes: layer.modes });
      const field = stroke
        ? BIND_FIELD.border
        : layer.type === BIND_VALUE.textLayer
          ? BIND_FIELD.color
          : BIND_FIELD.background;

      return {
        layer: layer.id,
        kind: BIND_KIND.color,
        field,
        value,
        candidates: [...exact, ...opaque, ...this.#inferred(index, inferred, scope, variables)],
        stylable,
        place: { kind: BIND_KIND.color, at, index: position, ...(range === undefined ? {} : { range }), opacity },
      };
    });
  }

  /** A layer's raw numbers, each in the Figma fields it binds (four corners or sides as one when they agree). */
  #numbers(
    index: BindIndex,
    layer: ScannedLayer,
    variables: BindScan["variables"],
  ): BindUse[] {
    return this.#fields.numbers(layer).map(({ fields, css, scope, value }) => {
      const [first = ""] = fields;
      const inferred = this.#inferred(index, layer.inferred?.[first] ?? [], scope, variables);

      return {
        layer: layer.id,
        kind: BIND_KIND.number,
        field: css,
        value: this.#values.number(css, value),
        candidates: [...index.numbers(value, { scope, modes: layer.modes }), ...inferred],
        stylable: false,
        place: { kind: BIND_KIND.number, fields: [...fields] },
      };
    });
  }

  /**
   * The variables Figma infers for a field (P-164) that the file does not hold, a library's, as candidates within the
   * field's scopes; those the file holds the index has matched by its own rules (modes, scopes, an alias first).
   */
  #inferred(
    index: BindIndex,
    ids: readonly string[],
    scope: BindScope,
    variables: BindScan["variables"],
  ): BindCandidate[] {
    return [...new Set(ids)].flatMap((id) => {
      const variable = variables[id];

      if (variable === undefined || index.holds(id) || !this.#fields.allows(variable.scopes, scope)) {
        return [];
      }

      const { resolvedType: type, key } = variable;

      return [{ token: this.#names.variable(variable), id, source: BIND_SOURCE.variable, type, key }];
    });
  }

  /** A layer's effects no style holds, then its runs no text style sets, with the styles holding the same. */
  #styled(index: BindIndex, layer: ScannedLayer): BindUse[] {
    const effects = layer.effects === undefined ? null : this.#values.effects(layer.effects, index.tables);
    const uses: Omit<BindUse, "layer" | "stylable">[] = [
      ...(effects === null
        ? []
        : [
          {
            kind: BIND_KIND.effect,
            field: BIND_FIELD.effects,
            value: effects,
            candidates: index.effects(effects),
            place: { kind: BIND_KIND.effect },
          },
        ]),
      ...layer.texts.map(({ range, ...parts }) => {
        const value = this.#values.text(parts);

        return {
          kind: BIND_KIND.text,
          field: BIND_FIELD.font,
          value,
          candidates: index.texts(value),
          place: { kind: BIND_KIND.text, range },
        };
      }),
    ];

    return uses.map((use) => ({ ...use, layer: layer.id, stylable: false }));
  }

  #remap(
    index: BindIndex,
    scan: BindScan,
    remap: readonly BindRemap[],
    report: BindReport,
  ): void {
    const pairs = remap.flatMap(({ from, to }) => {
      const pair = this.#pair(index, from, to);

      if (typeof pair === "string") {
        report.error(from, pair);

        return [];
      }

      return [pair];
    });

    for (const layer of scan.layers) {
      for (const pair of pairs) {
        const count = layer.uses[pair.source.id] ?? 0;

        // A text style is set with the text's fonts loaded: where Figma lacks one, the writer could not.
        if (count > 0 && layer.missingFont !== undefined && pair.source.type === STYLE_TYPE.text) {
          report.error(layer.id, BIND_TEXT.missingFont);
        } else if (count > 0) {
          report.remapped(pair, layer.id, count);
        }
      }
    }
  }

  /** The pair's style or variable each, of one kind; a sentence saying why not otherwise. */
  #pair(
    index: BindIndex,
    from: string,
    to: string,
  ): RemapPair | string {
    const [source, ...others] = index.byToken(from);
    const [target, ...more] = index.byToken(to);

    if (source === undefined || target === undefined) {
      return BIND_TEXT.missing(source === undefined ? from : to);
    }

    if (others.length > 0 || more.length > 0) {
      return BIND_TEXT.both(others.length > 0 ? from : to);
    }

    if (source.source !== target.source || source.type !== target.type) {
      return BIND_TEXT.kinds(from, TYPE_WORDS[source.type] ?? source.type, to, TYPE_WORDS[target.type] ?? target.type);
    }

    return { from, to, source, target };
  }
}

export const TOKENS_BIND = new InjectionToken<TokensBind>("TokensBind");

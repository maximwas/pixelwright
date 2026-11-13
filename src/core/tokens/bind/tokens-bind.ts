import { InjectionToken, inject, injectable } from "@needle-di/core";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import { BIND_FIELD, BIND_SCOPE, BIND_TEXT, BIND_VALUE, TYPE_WORDS } from "@/core/tokens/bind/bind.constants.ts";
import type { BindResult } from "@/core/tokens/bind/bind.schema.ts";
import type { BindCandidate, BindChoice, BindRemap, BindRequest, BindUse } from "@/core/tokens/bind/bind.types.ts";
import { BindChoices } from "@/core/tokens/bind/bind-choices.ts";
import { BIND_FIELDS } from "@/core/tokens/bind/bind-fields.ts";
import { BindIndex } from "@/core/tokens/bind/bind-index.ts";
import { BindReport } from "@/core/tokens/bind/bind-report.ts";
import { BIND_VALUES } from "@/core/tokens/bind/bind-values.ts";
import { BIND_KIND, BIND_PAINT_AT } from "@/shared/ops/bind/bind.constants.ts";
import type { BindScan, ScannedLayer } from "@/shared/ops/bind/bind.schema.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";

/** One token's uses to rebind to another, both found: as the call named them, and the style or variable each is. */
interface RemapPair {
  readonly from: string;
  readonly to: string;
  readonly source: BindCandidate;
}

/**
 * tokens_bind's plan (T-167, K-026..K-029): the scan's raw values set against the file's tokens. A value one token
 * holds exactly, as design_read prints it, in the layer's modes and within the token's scopes, is bound; several are
 * listed for a pick (choose), none unmatched (for tokens_apply); a pick of a token that does not hold the value snaps
 * it. With remaps the raw values are left alone and each layer's uses of a `from` token are counted for its `to`.
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
  ): BindResult {
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

    return report.result(scan.cut);
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
        ...this.#colors(index, layer),
        ...this.#numbers(index, layer),
        ...this.#styled(index, layer),
      ]) {
        report.add(use, choices.decide(use));
      }
    }
  }

  /**
   * A layer's raw solid colours with the tokens holding them: with the paint's opacity, else (see-through, none exact)
   * the opaque colour variables of its colour, which the paint keeps its opacity over (a design's `black 10%`).
   */
  #colors(index: BindIndex, layer: ScannedLayer): BindUse[] {
    return layer.paints.map(({ at, color, opacity, stylable }) => {
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

      return { layer: layer.id, kind: BIND_KIND.color, field, value, candidates: [...exact, ...opaque], stylable };
    });
  }

  #numbers(index: BindIndex, layer: ScannedLayer): BindUse[] {
    return this.#fields
      .numbers(layer)
      .map(({ css, scope, value }) => ({
        layer: layer.id,
        kind: BIND_KIND.number,
        field: css,
        value: this.#values.number(css, value),
        candidates: index.numbers(value, { scope, modes: layer.modes }),
        stylable: false,
      }));
  }

  /** A layer's effects no style holds, then its runs no text style sets, with the styles holding the same. */
  #styled(index: BindIndex, layer: ScannedLayer): BindUse[] {
    const effects = layer.effects === undefined ? null : this.#values.effects(layer.effects, index.tables);
    const texts = layer.texts.map((parts) => this.#values.text(parts));

    return [
      ...(effects === null
        ? []
        : [{ kind: BIND_KIND.effect, field: BIND_FIELD.effects, value: effects, candidates: index.effects(effects) }]),
      ...texts.map((value) => ({
        kind: BIND_KIND.text,
        field: BIND_FIELD.font,
        value,
        candidates: index.texts(value),
      })),
    ].map((use) => ({ ...use, layer: layer.id, stylable: false }));
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
      for (const { from, to, source } of pairs) {
        const count = layer.uses[source.id] ?? 0;

        if (count > 0) {
          report.remapped(from, to, layer.id, count);
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

    return { from, to, source };
  }
}

export const TOKENS_BIND = new InjectionToken<TokensBind>("TokensBind");

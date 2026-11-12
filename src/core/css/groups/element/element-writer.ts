import { inject, injectable } from "@needle-di/core";
import { ATTRIBUTE } from "@/core/apply/apply.constants.ts";
import type { PropertyWriter, WriteInput, WriteOutput } from "@/core/css/css.types.ts";
import {
  ASSET_TAGS,
  ELEMENT_ATTRIBUTES,
  ELEMENT_ERROR,
  ELEMENT_LISTS,
  ELEMENT_PATTERN,
  ELEMENT_TEXTS,
  ELEMENT_VALUE,
  MASK_FIGMA,
} from "@/core/css/groups/element/element.constants.ts";
import { NAME_VALUE_LIST } from "@/core/kernel/lists/name-value-list.ts";
import { INTENT_KEY } from "@/shared/write-intents/write-intent.constants.ts";

type Note = { category: string | null; label: string };

/**
 * What an element says about its layer beyond CSS written back: its name, link, component, variant and properties,
 * description, notes, the property a layer of a new component makes, its mask, and an asset's file.
 */
@injectable()
export class ElementWriter implements PropertyWriter {
  readonly attributes = ELEMENT_ATTRIBUTES;
  readonly #lists;

  constructor(lists = inject(NAME_VALUE_LIST)) {
    this.#lists = lists;
  }

  write({ tag, own, changed }: WriteInput, out: WriteOutput): void {
    for (const [attribute, key] of ELEMENT_TEXTS.filter(([attribute]) => changed(attribute))) {
      out.set(key, own(attribute) ?? "", attribute);
    }

    for (const key of ELEMENT_LISTS.filter(changed)) {
      const value = own(key) ?? "";
      const items = this.#lists.parse(value);

      if (items === null) {
        out.fail(key, ELEMENT_ERROR.badList(key, value), ELEMENT_ERROR.listHint);
      } else {
        out.set(key, items, key);
      }
    }

    if (changed(ATTRIBUTE.note)) {
      out.set(INTENT_KEY.notes, this.#notes(own(ATTRIBUTE.note) ?? ""), ATTRIBUTE.note);
    }

    if ([ATTRIBUTE.prop, ATTRIBUTE.visibleProp, ATTRIBUTE.swapProp].some(changed)) {
      this.#property(own, out);
    }

    if (changed(ATTRIBUTE.mask)) {
      this.#mask((own(ATTRIBUTE.mask) ?? "").trim().toLowerCase(), out);
    }

    if (changed(ATTRIBUTE.src)) {
      this.#asset(tag, own(ATTRIBUTE.src) ?? "", out);
    }
  }

  /** The text, visibility or swap property a layer of a new component makes. */
  #property(own: WriteInput["own"], out: WriteOutput): void {
    const text = own(ATTRIBUTE.prop);
    const visible = own(ATTRIBUTE.visibleProp);
    const swap = own(ATTRIBUTE.swapProp);
    const source =
      text === undefined ? (visible === undefined ? ATTRIBUTE.swapProp : ATTRIBUTE.visibleProp) : ATTRIBUTE.prop;

    out.set(
      INTENT_KEY.property,
      {
        ...(text === undefined ? {} : { text }),
        ...(visible === undefined ? {} : { visible }),
        ...(swap === undefined ? {} : { swap }),
      },
      source,
    );
  }

  #mask(value: string, out: WriteOutput): void {
    const maskType = MASK_FIGMA[value];

    if (value === ELEMENT_VALUE.noMask || value === "") {
      out.set(INTENT_KEY.mask, { isMask: false }, ATTRIBUTE.mask);
    } else if (maskType === undefined) {
      out.fail(ATTRIBUTE.mask, ELEMENT_ERROR.badMask(value));
    } else {
      out.set(INTENT_KEY.mask, { isMask: true, maskType }, ATTRIBUTE.mask);
    }
  }

  #asset(
    tag: string,
    src: string,
    out: WriteOutput,
  ): void {
    const kind = ASSET_TAGS[tag];

    if (kind === undefined) {
      out.fail(ATTRIBUTE.src, ELEMENT_ERROR.srcTag(tag), ELEMENT_ERROR.srcHint(src));
    } else {
      out.set(INTENT_KEY.asset, { kind, src }, ATTRIBUTE.src);
    }
  }

  /** design_read's notes: `Category: note | Another`, a bar or backslash in a note escaped with a backslash. */
  #notes(value: string): Note[] {
    return (value.match(ELEMENT_PATTERN.note) ?? [])
      .map((item) => item.replace(ELEMENT_PATTERN.escape, (_match, character: string) => character).trim())
      .filter((item) => item !== "")
      .map((item) => {
        const at = item.indexOf(ELEMENT_VALUE.category);

        return at === -1
          ? { category: null, label: item }
          : { category: item.slice(0, at), label: item.slice(at + ELEMENT_VALUE.category.length) };
      });
  }
}

/** A value alike layers hold apart: on which layer (the template's own), where under the template, which attribute. */
export interface RepeatField {
  readonly layer: string;
  /** The way down from the template, as `Tag "Name"` labels; none for the template itself. */
  readonly path?: string;
  /** An attribute's name, or `$text` for a text's characters. */
  readonly attribute: string;
}

/** A run read as its first: the template, every layer of the run, the fields they hold apart and a row per layer. */
export interface RepeatRead {
  readonly template: string;
  readonly layers: readonly string[];
  readonly fields: readonly RepeatField[];
  readonly rows: readonly (readonly (string | readonly string[])[])[];
}

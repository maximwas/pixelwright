# Tokens

`design_read` writes a bound colour or length as `var(--Name)` and lists the values it used in `tokens`;
`tokens_read` returns the whole set, and `tokens_usage` the layers that use one.

## Names

- A style: its name with every run of other characters than letters, digits, _ and - turned into "-": "Dark" →
  `--Dark`, "Brand/Primary 500" → `--Brand-Primary-500`. Letters of any script stay.
- A variable: its Web code syntax when the designer set one (var(--surface) → `--surface`), else its name the same
  way ("space/4" → `--space-4`).
- A text style is `--<name>-font`, holding its font shorthand: `font: var(--h3-font)`. Its letter spacing and case,
  when they are not the default, are `--<name>-letter-spacing` and `--<name>-text-transform`; an effect style's blurs
  are `--<name>-filter` and `--<name>-backdrop-filter` beside its shadows.
- Two styles of one kind with one name (two paint styles "Black") are different tokens: the file's first keeps
  `--Black`, the next are `--Black-2`, `--Black-3` (tokens_read notes them with their values). Use the one the layer
  names. The file's own styles come first; library styles are numbered among those the page uses, so every tool means
  one style by a name on that page (a read from another page may number a library's Black differently). Text styles
  are numbered alike: the second "h1" is `--h1-2-font` and `textStyle="h1-2"`.

## tokens_read

- It takes the file's own styles and variables, and with `used` those the current page (or `within`) uses, a team
  library's among them: a file built on a library has its tokens there.
- format css (default): `:root` holds every collection's default mode and the styles; every mode of a collection
  with several is a block `[data-<collection>="<mode>"]` with that collection's variables, the default's too (an
  element in it takes the default back inside another mode's). Put the attribute where design_read writes it
  (`data-brand="dark"` on a section) or on the html element for the whole page: a token in `:root` that points at
  another collection's token is computed in `:root` and does not follow a mode set lower in the page.
- format json: per collection, its modes and each variable's value in every mode, with its scopes (when not every
  field) and its code syntax.
- format dtcg: Design Tokens Format (DTCG 2025.10) trees, one per mode of each collection, keyed
  `<collection>.<mode>` (the collection alone when it has one mode), and one of styles, each to save as its own
  .json file for Style Dictionary or other DTCG tools. Aliases are `{path}`; a token whose path is also a group sits at
  the group's `$root`; a token takes the type of the tokens it is aliased with (a number a gap points at is a
  dimension), and one whose alias target took another type is written resolved, with a note. Named in `notes`: an
  alias to a token no tree here holds (a library's, a collection left out), a name taken twice (the second suffixed
  -2), what DTCG has no type or field for (a text variable, a boolean, an image style, a gradient's angle, a text
  style's case).
- `collections` keeps only the named ones; `libraries: true` adds the enabled libraries' variables by name and type.
- Past `maxChars` (80 000) the summary comes back with the first whole tokens that fit, and the collections to read
  one at a time.
- An alias to a token the output leaves out (a collection you did not ask for) is named in `notes`.

## tokens_usage

`tokens_usage {token}` lists the layers on the current page (or inside `within`, or on every page with
`within: "file"`) that use a style or variable, named by its token as above (`--White-2`, `--h1-font`,
`--h1-letter-spacing`), with where each uses it (fill, stroke, effect, text, a text run, or a bound field). Use it to
tell same-named styles apart, or to see what a change to a token would touch.

## Values

- Colours as hex (rgba when see-through); a colour with an opacity variable as
  `color-mix(in srgb, … N%, transparent)`.
- Numbers in px, except opacity and font weight, which have no unit.
- Strings quoted; booleans as true or false (CSS has no booleans: a note says so).
- An alias is `var(--other)`. One that points nowhere is a comment and a note.
- A gradient paint style is a token as linear-, radial- or conic-gradient().

## Not tokens yet

Paint styles CSS cannot draw (an image, a diamond or a turned radial gradient, one without stops), effect styles with
no shadow or blur CSS can write, and library variables the file does not use (Figma gives their values only once
they are imported into the file: `libraries: true` lists them by name and type). The styles left out are named in
`notes`; a `var()` design_read writes without a value is named in its hints.

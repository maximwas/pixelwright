/** The guide's tokens topic. */
export const TOKENS = {
  about: "How tokens are named and written: styles, variables, modes, aliases, units, libraries.",
  markdown: `# Tokens

\`design_read\` writes a bound colour or length as \`var(--Name)\` and lists the values it used in \`tokens\`;
\`tokens_read\` returns the whole set.

## Names

- A style: its name with every run of other characters than letters, digits, _ and - turned into "-": "Dark" →
  \`--Dark\`, "Brand/Primary 500" → \`--Brand-Primary-500\`. Letters of any script stay.
- A variable: its Web code syntax when the designer set one (var(--surface) → \`--surface\`), else its name the same
  way ("space/4" → \`--space-4\`).
- A text style is \`--<name>-font\`, holding its font shorthand: \`font: var(--h3-font)\`.
- Two styles of one kind with one name (two paint styles "Black") are different tokens: the file's first keeps
  \`--Black\`, the next are \`--Black-2\`, \`--Black-3\` (tokens_read notes them with their values). Use the one the
  layer names. The file's own styles come first; library styles are numbered among those the page uses, so every tool
  means one style by a name on that page (a read from another page may number a library's Black differently). Text
  styles are numbered alike: the second "h1" is \`--h1-2-font\` and \`textStyle="h1-2"\`, and design_apply binds it so.

## tokens_read

- It takes the file's own styles and variables, and those the current page (or \`within\`) uses from a team library:
  a file built on a library has its tokens there. \`used: false\` keeps only the file's own.
- format css (default): \`:root\` holds every collection's default mode and the styles; every mode of a collection
  with several is a block \`[data-<collection>="<mode>"]\` with that collection's variables, the default's too (an
  element in it takes the default back inside another mode's). Put the attribute where design_read writes it
  (\`data-brand="dark"\` on a section) or on the html element for the whole page: a token in \`:root\` that points at
  another collection's token is computed in \`:root\` and does not follow a mode set lower in the page.
- format json: per collection, its modes and each variable's value in every mode.
- format dtcg: Design Tokens Format (DTCG 2025.10) files, one per mode of each collection, keyed
  \`<collection>.<mode>\` (the collection alone when it has one mode), and \`styles\` for the styles; aliases are
  \`{path}\`, a token whose path is also a group sits at the group's \`$root\`; a token takes the type of the tokens
  it is aliased with (a number a gap points at is a dimension). Style Dictionary and other DTCG tools read them. Named
  in \`notes\`: an alias to a token no file here holds (a library's, a collection left out), a name taken twice (the
  second suffixed -2), and what DTCG has no type for (a text variable, a boolean, an image style).
- \`collections\` keeps only the named ones; \`libraries: true\` adds the enabled libraries' variables by name and type.
- Past \`maxChars\` (80 000) only the summary comes back, with the collections to read one at a time.
- An alias to a token the output leaves out (a collection you did not ask for) is named in \`notes\`.

## tokens_apply

- It takes what tokens_read returns with format json, or the same shape written by hand: \`collections\` (each with
  \`name\`, \`modes\` and \`variables\`: \`name\`, \`type\` if you like, \`values\` by mode name, \`description\`,
  \`token\`) and \`styles\` (\`paint\`, \`text\`, \`effect\`: \`name\` and \`value\`). Values are CSS, as below.
- Collections, modes and variables are found by name in the file's own collections, or made; a new collection's
  first mode renames Figma's default one. A variable's type comes from its first value when not given.
  \`var(--token)\` makes an alias, to a variable of the call (in any order) or of the file. A \`token\` other than the
  name's own becomes the variable's Web code syntax.
- A paint style's value reads as a \`background\` (colours, a colour variable), a text style's as the \`font\`
  shorthand, an effect style's as a \`box-shadow\` list.
- A value a variable or style already holds is left as it is, so sending tokens_read's own output writes nothing;
  send only what you change. Nothing is ever deleted (use \`execute\` to remove a token).
- A library's collection or style the file uses is never copied into the file: change it in the library.
- More modes than the file's Figma plan allows (Starter: one a collection): that mode's error says the plan's limit
  and the other modes are written. A dry run cannot know the plan, and a \`version\` is saved before the write.
- One undo step; \`dryRun\` checks names, types, modes and aliases without writing. \`version: "Before the brand
  change"\` first saves a named version in the file's history, for the designer to go back to, when the call changes
  something.

## tokens_bind

- It binds raw values to the tokens holding them exactly, as design_read writes both (\`#3B2FD9\`, \`16px\`, a font
  shorthand): colour variables and paint styles, number variables (gaps, padding, radii, border widths, opacity),
  text styles and effect styles; a colour variable in each layer's mode, a variable only within its scopes. A colour
  at an opacity binds to its colour's opaque variable and keeps the opacity.
- Results come grouped by value: \`bound\`, \`ambiguous\` (several tokens hold it: \`choose: [{value, token}]\` picks
  one), \`unmatched\` (no token holds it: make one with tokens_apply). A choose for a value no candidate holds snaps
  the layers to the token (\`snapped\`); \`field\` narrows a choice to background, border, color, gap, padding….
- \`remap: [{from: "--blue-500", to: "--brand"}]\` moves every use of one token to another of its kind (merging
  duplicates); raw values are then left alone.
- Instances are left out: bind their main components, and the instances follow. One undo step; \`dryRun\` lists
  without writing, \`version\` saves a named version first when the call changes something.

## Values

- Colours as hex (rgba when see-through); a colour with an opacity variable as \`color-mix(in srgb, … N%, transparent)\` (\`in display-p3\` in a Display P3 file).
- Numbers in px, except opacity and font weight, which have no unit.
- Strings quoted; booleans as true/false (CSS has no booleans); easings as CSS easing functions (a keyword, cubic-bezier(), or a spring
  drawn as linear());
  durations in seconds.
- An alias is \`var(--other)\`. One that points nowhere is a comment and a note.

A text style is \`--<name>-font\`, with \`also\` holding \`--<name>-letter-spacing\` and \`--<name>-text-transform\`
when they are not the default. A gradient paint style is a token once a layer that uses it is read (Figma writes its
CSS for that layer).

## Not tokens yet

Paint styles with images, gradient styles no layer read uses, blur effect styles, and library variables the file does
not use (Figma gives their values only once they are imported into the file: \`libraries: true\` lists them by name
and type). Paint styles and effect styles that are left out are named in \`notes\`; a \`var()\` design_read writes
without a value is named in its hints.
`,
} as const;

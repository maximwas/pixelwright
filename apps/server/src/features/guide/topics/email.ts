/** The guide's email topic. */
export const EMAIL = {
  about: "Turning the XML into an HTML email that renders in Gmail, Outlook and Apple Mail.",
  markdown: `# Building an HTML email from the XML

Email clients are not browsers: Gmail strips \`<style>\` blocks it does not like, Outlook on Windows renders with Word
and ignores flex, grid, position and most of CSS. Read the section with \`design_read\` (and \`screenshot\` to compare),
then translate:

## Layout

- The design's width (usually 600 px) becomes a centred \`<table width="600">\` inside a 100%-wide wrapper table.
- Every flex column is a stack of table rows; every flex row is one row with a \`<td>\` per child; \`gap\` becomes
  padding on the cells or spacer cells; \`justify-content\`/\`align-items\` become \`align\` and \`valign\` on cells.
- \`position: absolute\` has no email equivalent: text over a picture means a background image on the cell (with a
  solid background colour as the fallback) or one image with the text in it and \`alt\`.
- Write sizes as attributes too (\`width\`, \`height\` on tables, cells and images), not only in CSS.

## Styles

- Inline every style on its element (\`style="…"\`); keep a small \`<style>\` only for media queries and dark mode.
- Colours from \`tokens\` as plain hex: email clients do not support \`var()\`.
- Fonts: the \`fonts\` list tells which families the design uses. Web fonts load in Apple Mail and some others only:
  always end the stack with a safe fallback (\`'Satoshi', Arial, sans-serif\`).
- Borders, radius, padding and background colours work on cells; \`box-shadow\`, \`filter\` and \`backdrop-filter\` do
  not render in most clients: drop them or bake them into an image.

## Images

- Export with \`assetsDir\` or \`assets_export\` at 2x (the default) and give each \`<img>\` its 1x \`width\` and
  \`height\` attributes, \`display:block\`, \`border:0\` and a real \`alt\`.
- Icons as SVG do not render in many clients: export them as PNG (\`assets_export\` with \`format: "PNG"\`).
- Host the files on a server or CDN; email clients cannot read local paths.

## Links and text

- Every button is a link (\`href\` in the XML when the design has one): a table cell with the background colour and an
  \`<a>\` with padding inside, never a \`<button>\`.
- Keep the text as text, not images, so it can be read and translated; give line heights in px.

## Dark mode

Clients invert colours on their own; check the result with a screenshot of the light design, and add
\`@media (prefers-color-scheme: dark)\` rules (supported in Apple Mail and Outlook for Mac) for logos and backgrounds
that turn unreadable.
`,
} as const;

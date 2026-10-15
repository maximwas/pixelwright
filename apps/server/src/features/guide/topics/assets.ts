/** The guide's assets topic. */
export const ASSETS = {
  about: "What becomes a file, in which format, and how files are named.",
  markdown: `# Assets

Only true assets become files; everything else is CSS.

## What is an asset

- \`Icon\` (SVG): a vector, Figma Draw's text on a path or transform group, or a group, frame or instance without auto
  layout drawn only with vector shapes, at least one of them a true vector (a logo, an arrow in a circle). Exported with
  everything it draws, strokes outside its box included, and sized by that box.
- \`Image\` (PNG at 2x): a layer filled with an image, a mask group (its bottom layer is the mask), a layer with a
  video, pattern or shader fill or a noise, texture or glass effect. Exported as its own box: its corners, drop
  shadows and outline stay CSS around it, and the rest of its look (opacity, blur, inner shadows) is left to the
  file, as Figma renders it.
- A layer the designer marked for export (PNG, JPG or SVG; a PDF export is not a web asset), in that format, when it
  holds no text (an export on a section with text is a preview, read as layers). A frame with an image fill and children keeps its children: the image is its
  \`background\`, written as the original image.
- Plain rectangles, ellipses, buttons, cards, shadows are CSS, never images.

## design_read vs assets_export

- \`design_read\` with \`assetsDir\` writes the assets of the section it reads, and its XML points at the files.
- \`assets_export\` writes files on their own: \`nodes\` (up to 50 layers, one file each, in the format and scale you
  give: PNG, JPG, WebP, SVG or PDF; \`width\`, the CSS width the build shows a layer at, sets the render to width ×
  scale px) or \`from\` (every asset inside one layer). \`original: true\` writes the images as they were placed, full
  size and in their own format, instead of renders.
- design_read without \`assetsDir\` only plans names. When assets_export writes a file under another name (the name
  holds other bytes, the same bytes are another layer's file, an original is a JPEG), the file has \`planned\`: use
  its \`path\` in the \`src\`.

## Files

Named after the layer (\`Hero photo\` → hero-photo.png, a component's variant added: company-logo-amazon.svg). The
same bytes are written once and shared; a name already taken by other bytes gets -2; a file already in the folder is
never overwritten with other bytes.
`,
} as const;

# Assets

Only true assets become files; everything else is CSS.

## What is an asset

- `Icon` (SVG): a vector, Figma Draw's transform group, or a group, frame or instance without auto layout drawn only
  with vector shapes, at least one of them a true vector (a logo, an arrow in a circle). Exported with everything it
  draws, strokes outside its box included, and sized by that box.
- `Image` (PNG at 2x): a layer filled with an image, a mask group (its bottom layer is the mask), a layer with a
  pattern or shader fill or a noise, texture or glass effect. Exported as its own box: its corners, drop shadows and
  outline stay CSS around it, and the rest of its look (opacity, blur, inner shadows) is left to the file, as Figma
  renders it.
- A layer the designer marked for export (PNG, JPG or SVG; a PDF export is not a web asset), in that format, when it
  holds no text (an export on a section with text is a preview, read as layers). A frame with an image fill and
  children keeps its children: the image is its `background`, written as the original image.
- Plain rectangles, ellipses, buttons, cards, shadows are CSS, never images.

## Video

A layer filled with a video is no file: the Plugin API exports none. `design_read` lists it in `assets` with
`kind: "video"` and no `src`, its `$css` says the fill is a video, `inspect` gives the fill's type `VIDEO`, and
`assets_export` reports it in `errors` with `kind: "video"` while it writes the rest. The build brings its own video
file: ask the user for it, and use a render of the layer (`screenshot`) only as its poster.

## Fades and textures baked into images

- A fade baked into an image (a gradient fill on the photo's layer, or a gradient layer over a photo at a section's
  edge; design_read's hints name them) is flattened by an export and stretches with the box on wide screens. Export
  the raw image with `assets_export` and `original: true`, and build the gradient in CSS over it.
- A frame filled with a tiled texture (a noise image repeated at a scale) renders coarser or finer at another scale:
  the hint gives the scale. Export one tile at that scale and repeat it in CSS, or replace it.

## design_read vs assets_export

- `design_read` with `assetsDir` writes the assets of the section it reads, and its XML points at the files.
- `assets_export` writes files on their own: `nodes` (up to 50 layers, one file each, in the format and scale you
  give: PNG, JPG, WebP, SVG or PDF; `width`, the CSS width the build shows a layer at, sets the render to width ×
  scale px) or `from` (every asset inside one layer). `original: true` writes the images as they were placed, full
  size and in their own format, instead of renders.
- WebP keeps transparency exactly: its alpha is stored without loss at any `quality`. `quality` (1 to 100, 85 by
  default) is how lossy its colours are, so a transparent PNG becomes a WebP with the same see-through pixels.
- design_read without `assetsDir` only plans names. When assets_export writes a file under another name (the name
  holds other bytes, the same bytes are another layer's file, an original is a JPEG), the file has `planned`: use its
  `path` in the `src`.

## Files

Named after the layer (`Hero photo` → hero-photo.png, a component's variant added: brand-logo-dark.svg), or, in
assets_export, as `names` gives a layer id (`{"54:12": "hero-mountains"}` → hero-mountains.png, slugged the same
way). The same bytes are written once and shared; a name already taken by other bytes gets -2; a file already in the
folder is never overwritten with other bytes.

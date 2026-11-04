/**
 * A layer's boxes on the canvas as Figma gives them, for every op that measures (the read's box fields, cover, export,
 * inspect): its layout box, and the box it paints in (centred or outside strokes, shadows); null where Figma has none.
 */
export class LayerBoxes {
  /** The layout box; none for a node that is no layer (the document, a page). */
  layout(node: BaseNode): Rect | null {
    return "absoluteBoundingBox" in node ? node.absoluteBoundingBox : null;
  }

  /** The box it paints in, past its layout box too; none for a layer that paints nothing. */
  painted(node: BaseNode): Rect | null {
    return "absoluteRenderBounds" in node ? node.absoluteRenderBounds : null;
  }
}

// url=<POSITIVUS>?node-id=2-4221
// component=Heading
// source=src/components/Heading.tsx
import figma from "figma";

// Positivus's Heading: a variant per colour, and its text split over highlighted lines.
const heading = figma.selectedInstance;
const tone = heading.getEnum("Property 1", {
  Green: "green",
  White: "light",
  Black: "dark",
});
const text = heading
  .findLayers((layer) => layer.type === "TEXT")
  .map((layer) => (layer.type === "TEXT" ? layer.textContent : ""))
  .join(" ");

export default {
  example: figma.tsx`<Heading tone="${tone}">${text}</Heading>`,
  imports: ['import { Heading } from "@/components/Heading"'],
  id: "heading",
};

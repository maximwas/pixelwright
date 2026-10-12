// url=<POSITIVUS>?node-id=2-4681
// component=Link
// source=src/components/Link.tsx
import figma from "figma";

// Positivus's "Learn more" link: a variant per colour, its label from the text layer, the arrow icon left to the code.
const link = figma.selectedInstance;
const tone = link.getEnum("Property 1", {
  Black: "dark",
  Green: "accent",
  White: "light",
});

export default {
  example: figma.tsx`<Link tone="${tone}" href="#">${link.findText("Label").textContent}</Link>`,
  imports: ['import { Link } from "@/components/Link"'],
  id: "link",
};

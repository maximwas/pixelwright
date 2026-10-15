// url=<ORBIT>?node-id=81-1514
// component=Callout
// source=src/components/Callout.tsx
import figma from "figma";

// Orbit's callout: its Title and Body text properties as props, the buttons in its Actions slot as children, each
// rendered by its own Code Connect file.
const callout = figma.selectedInstance;

export default {
  example: figma.tsx`<Callout title="${callout.getString("Title")}" body="${callout.getString("Body")}">
  ${callout.getSlot("Actions")}
</Callout>`,
  imports: ['import { Callout } from "@/components/Callout"'],
  id: "callout",
};

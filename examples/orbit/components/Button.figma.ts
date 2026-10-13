// url=<ORBIT>?node-id=54-201
// component=Button
// source=src/components/Button.tsx
import figma from "figma";

// Orbit's Button: a variant and a state, its label from the Label text property.
const button = figma.selectedInstance;
const variant = button.getEnum("Variant", {
  Primary: "primary",
  Secondary: "secondary",
});
const disabled = button.getEnum("State", {
  Default: "",
  Hover: "",
  Disabled: " disabled",
});

export default {
  example: figma.tsx`<Button variant="${variant}"${disabled}>${button.getString("Label")}</Button>`,
  imports: ['import { Button } from "@/components/Button"'],
  id: "button",
};

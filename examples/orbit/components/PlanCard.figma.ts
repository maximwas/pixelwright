// url=<ORBIT>?node-id=54-202
// component=PlanCard
// source=src/components/PlanCard.tsx
import figma from "figma";

// Orbit's pricing card: its text properties as props, the Popular badge as a flag, the Button inside as its own code.
// component= is the code component's name, as Figma's Code Connect defines it; the Figma name "Plan Card" matches it.
const card = figma.selectedInstance;
const popular = card.getBoolean("Popular") ? " popular" : "";

export default {
  example: figma.tsx`<PlanCard name="${card.getString("Name")}" price="${card.getString("Price")}" description="${card.getString("Description")}"${popular}>
  ${card.findInstance("Button").executeTemplate().example}
</PlanCard>`,
  imports: ['import { PlanCard } from "@/components/PlanCard"'],
  id: "plan-card",
};

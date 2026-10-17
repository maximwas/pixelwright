import * as z from "zod";

/** An accessibility read of a screen: what its markup needs beyond the look. */
export const A11ySchema = z.object({
  summary: z.string(),
  headings: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        level: z.number().int().min(1).max(6),
        size: z.number(),
        from: z
          .enum(["style", "size"])
          .describe("Its text style's name says the level, or its size among the screen's."),
      }),
    )
    .describe("Texts that read as headings, in reading order."),
  controls: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        role: z.string().describe("button, link, checkbox, radio, switch, tab, textbox, combobox, menuitem."),
        label: z.string().nullable().describe("What a screen reader says: its text, a field's label; null when none."),
        why: z.string().describe("What makes it this role: its prototype action, or its component."),
        suggestion: z.string().exactOptional(),
      }),
    )
    .describe("What people press or type in, in reading order."),
  images: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        alt: z.string().nullable().describe("An alt text from its name; null when its name is Figma's default."),
        decorative: z.boolean(),
      }),
    )
    .describe("Pictures outside controls."),
  order: z.array(z.string()).describe("Where layers placed by hand read in another order than they show."),
  notes: z.array(z.string()),
});

export type A11yRead = z.output<typeof A11ySchema>;

export type A11yHeading = A11yRead["headings"][number];

export type A11yControl = A11yRead["controls"][number];

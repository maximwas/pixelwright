import * as z from "zod";

/** What states_find answers. */
export const StatesSchema = z.object({
  summary: z.string(),
  components: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        kind: z.string().describe("button, field, toggle, tab or link, by its name."),
        states: z.array(z.string()).describe("The states its variants and properties show."),
        missing: z.array(z.string()).describe("The states its kind needs that none shows."),
        properties: z.array(z.string()).describe("The properties holding its states."),
      }),
    )
    .describe("Interactive components, those lacking most first."),
  screens: z
    .array(
      z.object({
        name: z.string(),
        kind: z.string().describe("list or form."),
        frames: z.array(z.string()).describe("The frames of this screen: its widths and states."),
        states: z.array(z.string()),
        missing: z.array(z.string()),
      }),
    )
    .describe("Screens that show data or take input, grouped by name, with the states their frames show."),
  notes: z.array(z.string()),
});

export type States = z.output<typeof StatesSchema>;

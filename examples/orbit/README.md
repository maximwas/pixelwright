# Example: Orbit

A small project built from Orbit, the demo pricing site made for Pixelwright, the way an agent builds one with it:
the tokens from `tokens_read`, the components from `design_read`, the [Figma Code Connect](https://www.figma.com/developers/code-connect)
files that tie each Figma component to its code, and a baseline that tells later what the designer changed.

```
examples/orbit/
├── figma.config.json                 which files are Code Connect files, and the file link they point at
├── components/                       Code Connect, written exactly as Figma documents it
│   ├── Button.figma.ts               Variant and State as props, the Label text property as children
│   ├── PlanCard.figma.ts             Name, Price, Description and Popular as props, the Button inside by its own file
│   ├── Callout.figma.ts              Title and Body as props, the buttons in its Actions slot as children
│   ├── components.figma.batch.json   one row per component: Badge (its Label as children) and Icon/Check (lucide's)
│   └── component.figma.batch.ts      the shared template the rows run: each row's props table, Figma property to prop
├── src/
│   ├── styles/tokens.css             tokens_read's CSS: the Orbit colours, spacing, radii, text styles and shadow
│   ├── styles/components.css         the components' CSS, every value a token; the breakpoints from breakpoints_find
│   ├── components/                   Button, Badge, PlanCard and Callout, their props named after the Figma properties
│   └── pages/Pricing.tsx             the Plans row and the Callout under it, as design_read gives them with the files
└── .pixelwright/baselines/plans.json baseline_save of the Plans row, with the files built from it
```

## Try it

1. Open the Orbit demo file in Figma (a copy from the Figma Community, or any file with the same components), and
   run the Pixelwright plugin in it. Its **Start here** page lists what every tool shows on which layer.
2. Start your MCP client in this folder (or set `CLAUDE_PROJECT_DIR` to it), so the Code Connect files and the
   baseline are found.
3. Ask it to read the Plans row of **Pricing – Desktop**.

`design_read` writes each connected card as `$code` in the XML and gives its code, the button's inside it (one of
three cards); `unread` would name a property the code left out:

```json
{
  "codeComponents": [
    {
      "ids": ["54:268"],
      "component": "PlanCard",
      "template": "components/PlanCard.figma.ts",
      "source": "src/components/PlanCard.tsx",
      "snippet": "<PlanCard name=\"Pro\" price=\"$12\" description=\"For freelancers shipping fast.\" popular>\n  <Button variant=\"primary\">Get started</Button>\n</PlanCard>",
      "imports": ["import { PlanCard } from \"@/components/PlanCard\"", "import { Button } from \"@/components/Button\""]
    }
  ]
}
```

`code_connect_read` lists the files with what each connects and how it matched; `components_read` gives every
component's `code`, and with `mapped: false` the ones still without (in the demo, Logo). Change a price in Figma, then
ask `baseline_diff` what changed since the baseline (in a copy with another name, pass `file`), and `baseline_save`
with the `accept` it gives once the code follows.

## How the files match

Each template's `url` points at the component in the Orbit file (`documentUrlSubstitutions` in figma.config.json
puts the file's link in place of `<ORBIT>`). Where the component lives in the file being read, its id matches; in any
other file the name does: `component=Button` against the component set's name, `component=PlanCard` against the
component's ("Plan Card", spaces aside). For your own design system, `components_read` gives each component's `key`:
a template's `// key=` or a row's `"key"` then matches exactly that component, in every file, a library's included.
This example leaves keys out, so it also works in a copy of the demo file, whose components may get keys of their
own.
Add a row with the code component and its props table, or a template for one that needs logic of its own, and check
it with `code_connect_read`.

Types for editing templates come from `npm i -D @figma/code-connect` with
`"types": ["@figma/code-connect/figma-types"]` in your tsconfig. The components use React and `lucide-react`.

# Code Connect example: Orbit

[Figma Code Connect](https://www.figma.com/developers/code-connect) files for the components of Orbit, the demo
pricing page Pixelwright's tests run on, written exactly as Figma documents them: two templates (Button, Plan Card)
and a batch file whose rows map Badge and Icon/Check through one shared template. Pixelwright runs them locally, on
any Figma plan, without a token and without publishing anything.

```
examples/orbit/
├── figma.config.json                which files are Code Connect files, and the file link they point at
└── components/
    ├── Button.figma.ts              Variant and State as props, the Label text property as children
    ├── PlanCard.figma.ts            Name, Price, Description and Popular as props, the Button inside through its template
    ├── components.figma.batch.json  one row per component: Badge (its Label as children) and Icon/Check (lucide's)
    └── component.figma.batch.ts     the shared template the rows run: each row's props table, Figma property to prop
```

## Try it

1. Open a Figma file whose components match the templates: a **Button** component set (Variant: Primary, Secondary;
   State: Default, Hover, Disabled; a text property Label) and a **Plan Card** component (text properties Name, Price
   and Description, a boolean Popular, a Button instance inside). Run the Pixelwright plugin in it.
2. Start your MCP client in this folder (or set `CLAUDE_PROJECT_DIR` to it), then ask it to read the row of cards.

`code_connect_read` lists both templates with the instances they connect. `design_read` writes each connected card as
`$code` in the XML and gives its code, the button's inside it (one of three cards):

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

## How they match

Each template's `url` points at the component in the Orbit file (`documentUrlSubstitutions` in figma.config.json
puts your file's link in place of `<ORBIT>`). Where the component lives in the file being read, its id matches; in
any other file the name does: `component=Button` against the component set's name, `component=PlanCard` against the
component's ("Plan Card", spaces aside). The batch rows also give each component's `key`, which `components_read`
lists: a row with a key matches exactly that component, in every file. For your own components, add a row with the
key, the code component and its props table (or copy a template for one that needs logic of its own), and check it
with `code_connect_read`.

Types for editing templates come from `npm i -D @figma/code-connect` with
`"types": ["@figma/code-connect/figma-types"]` in your tsconfig.

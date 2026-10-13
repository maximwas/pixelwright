# Code Connect example: Orbit

Two [Figma Code Connect](https://www.figma.com/developers/code-connect) templates for the Button and Plan Card
components of Orbit, the demo pricing page Pixelwright's tests run on, written exactly as Figma documents them.
Pixelwright runs them locally, on any Figma plan, without a token and without publishing anything.

```
examples/orbit/
├── figma.config.json          which files are templates, and the file link they point at
└── components/
    ├── Button.figma.ts        Variant and State as props, the Label text property as children
    └── PlanCard.figma.ts      Name, Price and Popular as props, the Button inside it through its own template
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
      "component": "Plan Card",
      "template": "components/PlanCard.figma.ts",
      "snippet": "<PlanCard name=\"Pro\" price=\"$12\" popular>\n  <Button variant=\"primary\">Get started</Button>\n</PlanCard>",
      "imports": ["import { PlanCard } from \"@/components/PlanCard\"", "import { Button } from \"@/components/Button\""]
    }
  ]
}
```

## How they match

Each template's `url` points at the component in the Orbit file (`documentUrlSubstitutions` in figma.config.json
puts your file's link in place of `<ORBIT>`). Where the component lives in the file being read, its id matches; in
any other file the name does: `component=Button` against the component set's name, `component=Plan Card` against
the component's. For your own components, copy a template, change the link, the name and what it reads, and check it
with `code_connect_read`.

Types for editing templates come from `npm i -D @figma/code-connect` with
`"types": ["@figma/code-connect/figma-types"]` in your tsconfig.

# Code Connect example: Positivus

Two [Figma Code Connect](https://www.figma.com/developers/code-connect) templates for the Heading and Link components
of the Positivus landing page template, written exactly as Figma documents them. Pixelwright runs them locally, on any
Figma plan, without a token and without publishing anything.

```
examples/positivus/
├── figma.config.json          which files are templates, and the file link they point at
└── components/
    ├── Heading.figma.ts
    └── Link.figma.ts
```

## Try it

1. Open a copy of the Positivus template in Figma Desktop and run the Pixelwright plugin in it.
2. Start your MCP client in this folder (or set `CLAUDE_PROJECT_DIR` to it), then ask it to read the Services section.

`code_connect_read` lists both templates with the instances they connect. `design_read` writes each connected instance
as `$code` in the XML and gives its code:

```json
{
  "codeComponents": [
    {
      "ids": ["2:4872"],
      "component": "Heading",
      "template": "components/Heading.figma.ts",
      "snippet": "<Heading tone=\"green\">Search engine optimization</Heading>",
      "imports": ["import { Heading } from \"@/components/Heading\""]
    },
    {
      "ids": ["2:4873", "2:4879"],
      "component": "Link",
      "template": "components/Link.figma.ts",
      "snippet": "<Link tone=\"dark\" href=\"#\">Learn more</Link>",
      "imports": ["import { Link } from \"@/components/Link\""]
    }
  ]
}
```

## How they match

Each template's `url` points at the component set in the Figma file (`documentUrlSubstitutions` in figma.config.json
puts your file's link in place of `<POSITIVUS>`). Where the component lives in the file being read, its id matches;
in any other file the name does: `component=Heading` against the component set's name. For your own components, copy
a template, change the link, the name and what it reads, and check it with `code_connect_read`.

Types for editing templates come from `npm i -D @figma/code-connect` with
`"types": ["@figma/code-connect/figma-types"]` in your tsconfig.

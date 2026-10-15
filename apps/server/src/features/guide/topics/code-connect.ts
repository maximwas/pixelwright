/** The guide's code-connect topic. */
export const CODE_CONNECT = {
  about:
    "Figma Code Connect: templates and batch files, keys, how design_read runs them, what the code leaves out, mapping a design system.",
  markdown: `# Code Connect

Pixelwright runs the project's **Figma Code Connect files** itself, on any Figma plan, without a token and without
publishing anything: \`design_read\` gives each instance a connection builds as \`$code\` in the XML (no children) and
its code in \`codeComponents\` (\`{ ids, component, template, source, snippet, imports, unread }\`: instances with the
same code once), with the read's \`imports\` once each and the failures in \`codeErrors\` (\`{ template, error, ids }\`).
Nested connected instances are inside their parent's snippet; the layer the read is of is never collapsed. The code
takes at most 40% of \`maxChars\` (the XML the rest), and all templates of a read five seconds: past either, instances
are read as layers. \`code: false\` reads every instance as layers.

## Mapping a design system

1. \`design_read\` the section; its hints name the components shown without code.
2. \`components_read within=<id> mapped=false\` gives each one's \`key\`, properties, variants and \`exposed\`
   instances.
3. Find the code component that builds it in the project (search the code; \`links: true\` reads the links people
   attached in Dev Mode, on paid plans, with the project file a code link points at).
4. Confirm each pair with the user.
5. Write a batch row (below), or a template for a component that needs logic of its own.
6. \`code_connect_read\` checks it: \`by\`, \`unread\`, \`values\`, \`missing\` and the problems.
7. \`design_read\` again: the instances are \`$code\` now.

## Batch files: one row per component

A \`*.figma.batch.json\` file (Figma's own format) holds one group \`{ "templateFile", "components" }\`, or an array
of them; each row runs through the group's shared template (ending \`.figma.batch.ts\` or \`.js\`, next to the batch
file), which reads the row as \`figma.batch\`:

\`\`\`json
{
  "templateFile": "./component.figma.batch.ts",
  "components": [
    { "key": "2f31fdc95b9804804df14c93a7f9c8913d611c17", "component": "PricingTier",
      "source": "src/components/PricingTier.tsx",
      "imports": ["import { PricingTier } from \\"@/components/PricingTier\\""],
      "props": { "Name": "name", "Price": "price", "Popular": "popular",
                 "Tier": { "prop": "tier", "values": { "Pro": "pro", "Free": "free" } },
                 "Description": "children" } }
  ]
}
\`\`\`

The shared template (\`examples/orbit/components/component.figma.batch.ts\`) writes the row's \`component\` with
each \`props\` entry: \`"Name": "name"\` passes the value, \`{ "prop", "values" }\` maps a variant's (\`getEnum\`) or a
toggle's (\`getBoolean\`) value, a prop named \`children\` goes between the tags, \`true\` is a bare prop, \`false\`,
\`null\` and \`""\` write nothing; \`imports\` are the row's, the id its \`id\` else the component. For Vue, use
the same template with \`figma.code\` in place of \`figma.tsx\`: a Vue template takes the same tags, string props and
bare toggles. A row is named \`<batch file>#<n>\`, n counting from 1 across the file's groups.

## Keys and matching

\`components_read\` gives each component's \`key\`, the same in every file, a library's included. A row's \`"key"\` or
a template's \`// key=\` (Pixelwright's addition, which Figma's CLI skips) connects exactly that component or set:
a keyed connection matches by key only. Figma's CLI needs a \`url\` (\`// url=\`) to publish a file; Pixelwright does
not, and says so once per file. Without a key, a connection matches by the id its url names (a component this file
defines) with the names agreeing, then by name (the Figma name's last part against \`component\`, else the file name
before \`.figma.\`, case, spaces and punctuation aside: \`Buttons/Primary Button\` matches \`PrimaryButton\`), then by
the id alone. \`code_connect_read\` gives the rule each matched by as \`by\` (\`key\`, \`id\`, \`name\`). A component made
again, or copied, gets a new key: its keyed connection then misses, and the component shows as unconnected.

## What the code leaves out

- \`unread\` names the properties no code read: the instance's own (\`Description\`), and those of the nested
  instances it exposes or whose properties it overrides (\`Button.Label\`). A text whose value the snippet holds counts
  as read. Write them in, or read the instance with \`node=<id>\`: the values are on the element (\`variant\`,
  \`props\`).
- \`values\` (code_connect_read) names the variant values a \`getEnum\` mapping misses: Figma renders them as
  \`undefined\`.
- \`missing\` marks a \`source\` that names a file in neither the project nor beside the Code Connect file (packages and
  URLs are not checked).
- \`exposed\` (components_read) and \`$exposed\` (design_read) mark the nested instances a component exposes: their
  properties are the component's API too, so in code they are its props.

## Where the files are

The project folder is \`CLAUDE_PROJECT_DIR\`, else the server's working directory (never the home folder or the disk's
root). Code Connect files are those ending in \`.figma.ts\`, \`.figma.js\`, \`.figma.template.ts\`,
\`.figma.template.js\` or \`.figma.batch.json\` among those \`figma.config.json\`'s \`codeConnect.include\` globs name
(minus \`exclude\`; its \`documentUrlSubstitutions\` are applied to urls), else all such files; dependency and build
folders are never searched. A batch file a custom \`include\` misses is left out, as Figma does, and named in the
problems.

## Writing one

Write it as Figma documents it, with types from the npm package \`@figma/code-connect\` (in tsconfig:
\`"types": ["@figma/code-connect/figma-types"]\`):

\`\`\`ts
// url=https://www.figma.com/design/<fileKey>/Kit?node-id=1-2
// component=Button
// source=src/components/Button.tsx
import figma from 'figma'

const button = figma.selectedInstance
const size = button.getEnum('Size', { Small: 'sm', Large: 'lg' })
const icon = button.getInstanceSwap('Icon')

export default {
  example: figma.tsx\`<Button size="\${size}"\${figma.helpers.react.renderProp('disabled', button.getBoolean('Disabled'))}>\${button.getString('Label')}\${icon?.executeTemplate().example}</Button>\`,
  imports: ['import { Button } from "@/components/Button"'],
  id: 'button',
}
\`\`\`

- \`url\`: the component's or component set's link (Copy link in Figma), or \`key\` (above). \`component\`: the code
  component's name, as Figma's Code Connect defines it (\`$code\` shows it). \`source\`: the code component's file.
- **Imports:** \`figma\` and the template's own relative helpers (\`import { sizes } from './helpers'\`, TypeScript or
  JavaScript); nothing else.
- **The API:** \`figma.selectedInstance\` (alias \`currentLayer\`) with \`getString\`, \`getBoolean(name, mapping?)\`,
  \`getEnum\`, \`getPropertyValue\`, \`getInstanceSwap\`, \`getSlot\` (the slot layer named after the property,
  \`connectedInstances\`), \`findInstance\`, \`findText\`, \`findLayers\`, \`findConnectedInstance(s)\` (with \`path\` and
  \`traverseInstances\`), \`executeTemplate\`, \`hasCodeConnect\`, \`codeConnectId\`, \`id\`, \`properties\`;
  \`figma.code\`, \`tsx\`, \`html\`, \`swift\`, \`kotlin\`, \`figma.helpers.react.*\`, \`figma.properties.*\`. Property names
  are as Figma shows them (without the #id suffix). Hidden layers are not found.
- **Errors** are the instance's alone: \`PROPERTY_NOT_FOUND\`, \`CHILD_LAYER_NOT_FOUND\` (when the missing layer is
  rendered), \`TEMPLATE_TIMEOUT\` (one second per instance, nested templates included; the template is not run again
  in that read), \`TEMPLATE_BUDGET\`, \`TEMPLATE_IMPORT\`, \`TEMPLATE_CYCLE\`, \`TEMPLATE_CUT\` (the read left out layers
  the code needs: read the instance on its own). Such an instance is read as usual, with its children.
- Old \`figma.connect(...)\` files are not run: \`npx figma connect migrate\` turns them into templates.

Templates run on this computer as the project's own code, in a separate context without \`require\`, \`process\` or
files, but that context is no protection against a hostile template: run Pixelwright only in projects you trust, as
you would their build scripts.
`,
} as const;

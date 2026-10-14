/** The guide's code-connect topic. */
export const CODE_CONNECT = {
  about: "Figma Code Connect templates: how design_read runs them, writing one, what Pixelwright supports.",
  markdown: `# Code Connect templates

Pixelwright runs the project's **Figma Code Connect templates** itself, on any Figma plan, without a token and without
publishing anything: \`design_read\` gives each instance a template connects as \`$code\` in the XML (no children) and
its code in \`codeComponents\` (\`{ ids, component, template, snippet, imports }\`: instances with the same code once),
with the read's \`imports\` once each and the failures in \`codeErrors\` (\`{ template, error, ids }\`). Nested connected
instances are inside their parent's snippet; the layer the read is of is never collapsed. The code takes at most 40% of
\`maxChars\` (the XML the rest), and all templates of a read five seconds: past either, instances are read as layers.
\`code: false\` reads every instance as layers. \`code_connect_read\` lists the templates, what each connects on the
page, the components none connects, and errors.

## Where templates are

The project folder is \`CLAUDE_PROJECT_DIR\`, else the server's working directory (never the home folder or the disk's
root). Templates are the files ending in \`.figma.ts\`, \`.figma.js\`, \`.figma.template.ts\` or \`.figma.template.js\`
among those \`figma.config.json\`'s \`codeConnect.include\` globs name (minus \`exclude\`; its
\`documentUrlSubstitutions\` are applied to urls), else all such files; dependency and build folders are never
searched.

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

- \`url\` (required): the component's or component set's link (Copy link in Figma). \`component\`: the code component's
  name, as Figma has it (\`$code\` shows it). \`source\`: the code component's file.
- **Matching:** the url's node-id is the instance's component or set when that lives in the file read; a library's
  component matches by name: the Figma name's last part against \`component\` (else the file name before \`.figma.\`),
  case, spaces and punctuation aside (\`Buttons/Primary Button\` matches \`PrimaryButton\`). Check with
  \`code_connect_read\`.
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

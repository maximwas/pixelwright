import figma from "figma";

// The shared template of a batch file: each row names the code component, its imports and which Figma property
// becomes which prop. "Name": "name" passes the value; {"prop": "variant", "values": {"Primary": "primary"}} maps a
// variant's or a toggle's value; a prop named children goes between the tags; true writes a bare prop, false, null
// and "" write nothing.
const row = figma.batch;
const instance = figma.selectedInstance;
const props = [];
let children = "";

for (const [property, target] of Object.entries(row.props ?? {})) {
  const prop = typeof target === "string" ? target : target.prop;
  const raw = instance.getPropertyValue(property);
  const value =
    typeof target === "string"
      ? raw
      : typeof raw === "boolean"
        ? instance.getBoolean(property, target.values)
        : instance.getEnum(property, target.values);

  if (prop === "children") {
    children = value ?? "";
  } else if (value === true) {
    props.push(` ${prop}`);
  } else if (value !== false && value !== null && value !== undefined && value !== "") {
    const text = String(value);

    props.push(text.includes('"') ? ` ${prop}={${JSON.stringify(text)}}` : ` ${prop}="${text}"`);
  }
}

const name = row.component ?? instance.name;

export default {
  example:
    children === ""
      ? figma.tsx`<${name}${props.join("")} />`
      : figma.tsx`<${name}${props.join("")}>${children}</${name}>`,
  imports: row.imports ?? [],
  id: row.id ?? row.component,
};

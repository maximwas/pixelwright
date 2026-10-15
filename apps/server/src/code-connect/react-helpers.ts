/*!
 * figma.helpers.react: adapted from @figma/code-connect 2.0.1, src/react/parser_template_helpers.ts
 * (https://github.com/figma/code-connect). Figma injects these into each template as source, where `figma.tsx` is the
 * template's own; here they take that tag as a parameter. Its licence (also in the package's THIRD-PARTY-NOTICES.md):
 *
 * MIT License
 *
 * Copyright (c) 2024 Figma
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
 * Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 * WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
/* biome-ignore-all lint/suspicious/noExplicitAny: Figma's helpers take whatever a template passes them. */
import type { ResultSection, TemplateStringResult } from "../types/code-connect.ts";

type Tag = (strings: TemplateStringsArray, ...values: unknown[]) => TemplateStringResult;
type FccValue = { $value: unknown; $type: string };

/** The kinds of value whose $value is code as it is. */
const CODE_TYPES = ["function", "identifier", "jsx-element", "react-component"];

/** figma.helpers.react for a template: what renders with JSX takes the template's own figma.tsx tag. */
export function reactHelpers(tsx: Tag) {
  const wrap = ($type: string) => ($value: unknown) => ({
    $value,
    $type,
  });

  return {
    renderProp: (name: string, prop: any) => renderProp(tsx, name, prop),
    renderChildren: (prop: any) => renderChildren(tsx, prop),
    renderPropValue,
    stringifyObject,
    jsxElement: wrap("jsx-element"),
    function: wrap("function"),
    identifier: wrap("identifier"),
    object: ($value: Record<string, unknown>): FccValue => ({
      $value,
      $type: "object",
      ...$value,
    }),
    templateString: wrap("template-string"),
    reactComponent: wrap("react-component"),
    array: wrap("array"),
    isReactComponentArray,
  };
}

function isReactComponentArray(prop: unknown): prop is ResultSection[] {
  return (
    Array.isArray(prop) &&
    prop.every(
      (item: any) =>
        item?.type === "INSTANCE" || item?.type === "SLOT" || item?.type === "CODE" || item?.type === "ERROR",
    )
  );
}

/** A value inside an object literal: <Button sx={{ key: value }} />. */
function renderPropValue(prop: any): any {
  if (isReactComponentArray(prop)) {
    return prop;
  }

  if (prop === undefined) {
    return "undefined";
  }

  if (typeof prop === "string") {
    return `"${escaped(prop)}"`;
  }

  if (typeof prop === "boolean" || typeof prop === "number") {
    return prop;
  }

  return typedValue(prop);
}

/** A wrapped value (figma.helpers.react.array(…) and the like) inside an object literal. */
function typedValue(prop: any): any {
  if (CODE_TYPES.includes(prop.$type)) {
    return prop.$value;
  }

  if (prop.$type === "array") {
    return `[${prop.$value.map((element: unknown) => renderPropValue(element))}]`;
  }

  if (prop.$type === "object") {
    return `{${Object.keys(prop.$value)
      .map((key) => ` ${key}: ${renderPropValue(prop.$value[key])} `)
      .join(",")}}`;
  }

  return prop.$type === "template-string" ? `\`${prop.$value}\`` : "undefined";
}

/** A React prop: a name alone for true, nothing for false or undefined, quotes for strings, braces for the rest. */
function renderProp(tsx: Tag, name: string, prop: any): TemplateStringResult | string {
  if (isReactComponentArray(prop)) {
    return prop.length > 1 ? tsx` ${name}={<>${prop}</>}` : tsx` ${name}={${prop}}`;
  }

  if (typeof prop === "boolean") {
    return prop ? ` ${name}` : "";
  }

  if (typeof prop === "string") {
    const text = escaped(prop);

    return text === "" ? "" : ` ${name}="${text}"`;
  }

  if (typeof prop === "number") {
    return ` ${name}={${prop}}`;
  }

  return prop === undefined ? "" : typedProp(name, prop);
}

/** A wrapped value as a React prop. */
function typedProp(name: string, prop: any): string {
  if (CODE_TYPES.includes(prop.$type)) {
    return ` ${name}={${prop.$value}}`;
  }

  if (prop.$type === "array" || prop.$type === "object") {
    return ` ${name}={${renderPropValue(prop)}}`;
  }

  return prop.$type === "template-string" ? ` ${name}={\`${prop.$value}\`}` : "";
}

/** React children: sections as they are, scalars as text, the other values wrapped as JSX wants them. */
function renderChildren(tsx: Tag, prop: any): any {
  if (isReactComponentArray(prop)) {
    return prop;
  }

  if (typeof prop === "string" || typeof prop === "number" || typeof prop === "boolean") {
    return prop;
  }

  if (prop === undefined) {
    return "";
  }

  return prop.$type === "template-string" ? tsx`{\`${prop.$value}\`}` : typedChild(prop);
}

/** A wrapped value as React children. */
function typedChild(prop: any): any {
  if (prop.$type === "jsx-element") {
    return prop.$value;
  }

  if (prop.$type === "function" || prop.$type === "identifier") {
    return `{${prop.$value}}`;
  }

  if (prop.$type === "array" || prop.$type === "object") {
    return `{${renderPropValue(prop)}}`;
  }

  return prop.$type === "react-component" ? `<${prop.$value} />` : undefined;
}

function stringifyObject(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((element) => stringifyObject(element)).join(",")}]`;
  }

  if (typeof value !== "object" || value instanceof Date || value === null) {
    return JSON.stringify(value);
  }

  return `{${Object.keys(value)
    .map((key) => ` ${key}: ${stringifyObject((value as Record<string, unknown>)[key])} `)
    .join(",")}}`;
}

function escaped(text: string): string {
  return text.replaceAll("\n", "\\n").replaceAll('"', '\\"');
}

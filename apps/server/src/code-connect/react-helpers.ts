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

export function reactHelpers(tsx: Tag) {
  const isReactComponentArray = (prop: unknown): prop is ResultSection[] =>
    Array.isArray(prop) &&
    prop.every(
      (item: any) =>
        item?.type === "INSTANCE" || item?.type === "SLOT" || item?.type === "CODE" || item?.type === "ERROR",
    );
  const wrap = ($type: string) => ($value: unknown) => ({
    $value,
    $type,
  });

  // A value inside an object literal: <Button sx={{ key: value }} />.
  const renderPropValue = (prop: any): any => {
    if (isReactComponentArray(prop)) {
      return prop;
    }

    if (prop === undefined) {
      return "undefined";
    }

    if (typeof prop === "string") {
      return `"${prop.replaceAll("\n", "\\n").replaceAll('"', '\\"')}"`;
    }

    if (typeof prop === "boolean" || typeof prop === "number") {
      return prop;
    }

    if (["function", "identifier", "jsx-element", "react-component"].includes(prop.$type)) {
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

    if (prop.$type === "template-string") {
      return `\`${prop.$value}\``;
    }

    return "undefined";
  };

  // A React prop: a name alone for true, nothing for false or undefined, quotes for strings, braces for the rest.
  const renderProp = (name: string, prop: any): TemplateStringResult | string => {
    if (isReactComponentArray(prop)) {
      return prop.length > 1 ? tsx` ${name}={<>${prop}</>}` : tsx` ${name}={${prop}}`;
    }

    if (typeof prop === "boolean") {
      return prop ? ` ${name}` : "";
    }

    if (typeof prop === "string") {
      const escaped = prop.replaceAll("\n", "\\n").replaceAll('"', '\\"');

      return escaped === "" ? "" : ` ${name}="${escaped}"`;
    }

    if (typeof prop === "number") {
      return ` ${name}={${prop}}`;
    }

    if (prop === undefined) {
      return "";
    }

    if (["function", "identifier", "jsx-element", "react-component"].includes(prop.$type)) {
      return ` ${name}={${prop.$value}}`;
    }

    if (prop.$type === "array" || prop.$type === "object") {
      return ` ${name}={${renderPropValue(prop)}}`;
    }

    if (prop.$type === "template-string") {
      return ` ${name}={\`${prop.$value}\`}`;
    }

    return "";
  };

  // React children: sections as they are, scalars as text, the other values wrapped as JSX wants them.
  const renderChildren = (prop: any): any => {
    if (isReactComponentArray(prop)) {
      return prop;
    }

    if (typeof prop === "string" || typeof prop === "number" || typeof prop === "boolean") {
      return prop;
    }

    if (prop === undefined) {
      return "";
    }

    if (prop.$type === "template-string") {
      return tsx`{\`${prop.$value}\`}`;
    }

    if (prop.$type === "jsx-element") {
      return prop.$value;
    }

    if (prop.$type === "function" || prop.$type === "identifier") {
      return `{${prop.$value}}`;
    }

    if (prop.$type === "array" || prop.$type === "object") {
      return `{${renderPropValue(prop)}}`;
    }

    if (prop.$type === "react-component") {
      return `<${prop.$value} />`;
    }

    return undefined;
  };

  const stringifyObject = (value: unknown): string => {
    if (Array.isArray(value)) {
      return `[${value.map((element) => stringifyObject(element)).join(",")}]`;
    }

    if (typeof value !== "object" || value instanceof Date || value === null) {
      return JSON.stringify(value);
    }

    return `{${Object.keys(value)
      .map((key) => ` ${key}: ${stringifyObject((value as Record<string, unknown>)[key])} `)
      .join(",")}}`;
  };

  return {
    renderProp,
    renderChildren,
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

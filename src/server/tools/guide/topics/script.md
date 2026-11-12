# Script

`execute` with `script` runs JavaScript on the server, where every read tool is an async function on `pw`: one call
can loop over layers, filter or join what several reads answer, and give back only what the task needs. The reads stay
the first answer; a script is for an answer that needs several of them.

## A script

- The body of an async function, in JavaScript, not TypeScript: `await` works, `return` gives `result`; what
  `console.log` prints comes back as `logs`.
- `pw.<read>(args)` is the read tool by its camelCase name, with the arguments it takes as a tool: `pw.nodesFind`,
  `pw.inspect`, `pw.designRead`, `pw.tokensRead`. Nothing a script calls writes.
- `types_read` gives each read's whole answer type: read it before the script. Reading a key the type does not have
  throws `pw.inspect: no field "nodes" here; fields: layers, ...`; a key the type has but this answer lacks is
  `undefined`, so `if (answer.more)` works.
- A number past its bound (`limit` over 500) runs at the bound and is listed in `clamped`; a key the tool does not take
  is refused with the keys it does.
- A failed call throws an Error naming the function and what was wrong, e.g. `pw.inspect: nodes: Invalid input:
  expected array`; catch it to go on. A failed run still lists in `calls` the calls that succeeded.

## Limits

- 30 s a run by default, `timeout` up to 300 s; a call gets what is left of it.
- 50 pw calls a run, 4 at once (the rest wait their turn).
- 64 MB of memory; code that keeps the CPU busy 1 s without a pause (an endless loop) is stopped.
- `result` is cut past 24,000 characters: a long list or text ends in a `--- TRUNCATED ---` marker, and `resultChars`
  gives the size before the cut. `logs` keeps the last 4,000 characters.
- No Node, no network, no timers, no Plugin API: only `pw`, `utils` and `console`. Plugin code goes in `code`.

## Images

A script cannot show an image: there is no `pw.screenshot` (nor `pw.nodeShow` or `pw.selectionWait`, which act on the
user's view), because a client that shows only execute's structured answer drops the image blocks. Call `screenshot`
itself for an image. `pw.designRead` with `screenshot: true` answers a handle, `image: "image-1"`; returned, execute
sends the image after its answer, but a client may not show it.

## Design XML in a script

`pw.designRead` answers `{ xml, json, tree }`: the XML, its JSON block, and `tree`, the XML's elements as data (`id`,
`tag`, `attributes` with the CSS and metadata such as `name` and `textStyle`, a Text's `text`, `children`), to filter
layers without parsing the XML.

## Utils

`utils` holds helpers built on pw, each of their pw calls counted in the run's limits like the script's own:

- `utils.layers(find?, { fields? })`: pw.nodesFind(find), then pw.inspect of what it found, 100 ids a call, each
  layer's find entry with its inspect fields over it (only `fields` when given).
- `utils.walk(tree, visit)` and `utils.find(tree, test)`: depth first over pw.designRead's tree or
  `utils.outlineTree(xml)` of pw.outline's XML; each element comes with `{ path, depth, hidden }`.
- `utils.map(items, fn, { limit? })`: at most 4 at once, the answers in order. `utils.chunk(items, size)`.
- `utils.color(value)`: a CSS colour as `{ r, g, b, a }`, null when it is none; `utils.color.same(one, other,
  tolerance?)`.

Every text of a frame with its font sizes, in a few calls rather than one per text:

```js
const { layers } = await utils.layers({ type: "TEXT", within: "185:239" }, { fields: ["text"] });
return layers.map(({ id, text }) => ({ id, sizes: text.fontSizes }));
```

Every text of the frame that is shown, with its text style:

```js
const { tree } = await pw.designRead({ node: "185:239" });
const texts = [];
utils.walk(tree, (element, { hidden }) => {
  if (element.tag === "Text" && !hidden) texts.push({ id: element.id, style: element.attributes.textStyle ?? null });
});
return texts;
```

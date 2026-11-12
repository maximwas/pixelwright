/**
 * create-figma-plugin's generated entry require()s the plugin's module, and esbuild then wraps every module behind it
 * and drops none of their unused code: the window's bundle carried all of core. The same entry importing the module
 * lets esbuild leave out what a bundle never runs.
 */
export function importingEntry(options) {
  const modules = [];
  const contents = options.stdin.contents.replace(/require\('(\.\/[^']+)'\)/g, (_, path) => {
    modules.push(path);

    return `entry${modules.length - 1}`;
  });

  if (modules.length === 0) {
    throw new Error("create-figma-plugin's entry no longer requires the plugin's modules: update build-entry.js.");
  }

  return {
    ...options,
    stdin: {
      ...options.stdin,
      contents: `${modules.map((path, index) => `import * as entry${index} from ${JSON.stringify(path)};`).join("\n")}\n${contents}`,
    },
  };
}

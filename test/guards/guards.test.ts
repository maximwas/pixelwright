import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { cruise } from "dependency-cruiser";
import extractDepcruiseOptions from "dependency-cruiser/config-utl/extract-depcruise-options";
import { ESLint, type Linter } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

// The repo's own ESLint and dependency-cruiser configs run over samples/ as if it were the repo root, so samples/src/x
// is judged as src/x. Each planted file must be refused by exactly its rules: a rule removed or weakened fails a case.
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SAMPLES = fileURLToPath(new URL("samples/", import.meta.url));

const EXPECTED: Record<string, string[]> = {
  "src/core/node-import/node-import.ts": ["no-node-without-node"],
  "src/core/legacy-import/legacy-import.ts": ["no-old"],
  "src/core/kernel/token-name/token-name.ts": ["kernel-on-nothing"],
  "src/server/tools/alpha/alpha.tool.ts": ["tools-apart"],
  "src/plugin/operations/xml-read/xml-read.operation.ts": ["plugin-no-server-core"],
  "src/plugin/operations/node-read/node-read.operation.ts": ["no-restricted-globals", "no-restricted-syntax"],
  "src/plugin/adapters/figma/css-of/css-of.ts": ["no-restricted-syntax"],
  "src/plugin/adapters/figma/current-page/current-page.ts": ["@figma/figma-plugins/ban-deprecated-sync-prop-setters"],
  "src/core/geometry/point.schema.ts": ["no-restricted-imports"],
  "src/core/long-function/long-function.ts": ["max-lines-per-function"],
  "src/core/is-on/is-on.ts": ["no-restricted-syntax"],
  "src/core/counter/counter.ts": ["no-restricted-syntax"],
  "src/core/exported-function/exported-function.ts": ["no-restricted-syntax"],
  "src/core/exported-arrow/exported-arrow.ts": ["no-restricted-syntax"],
  "src/core/default-function/default-function.ts": ["no-restricted-syntax"],
  "src/core/static-only/static-only.ts": ["@typescript-eslint/no-extraneous-class"],
  "src/core/short-name/short-name.ts": ["id-length"],
  "src/core/three-params/three-params.ts": ["layout/signature-paren-newline"],
  "src/server/app/service-locator/service-locator.ts": ["no-restricted-syntax"],
  "src/server/app/injected-class/injected-class.ts": ["no-restricted-syntax"],
  "src/server/app/LooseName.ts": ["project-structure/folder-structure"],
  "src/core/xml/index.ts": ["project-structure/folder-structure"],
  "src/core/welcome-text/welcome-text.ts": [
    "shape/no-string-literal",
    "shape/no-string-type",
    "shape/no-text-template",
  ],
  "src/plugin-ui/raw-html/raw-html.ts": ["no-restricted-syntax"],
  "src/core/kernel/names/slug-length/slug-length.ts": ["no-relative-import-paths/no-relative-import-paths"],
  "src/core/kernel/names/slug/slug.types.ts": ["no-relative-import-paths/no-relative-import-paths"],
  "src/server/tools/beta/beta.manifest.ts": ["imports/no-relative-path"],
  "test/support/slug-reach/slug-reach.ts": ["no-restricted-imports"],
  "src/core/lost-import/lost-import.ts": ["no-unresolved-alias"],
  // Clean by rule: texts and text arrows live in .constants.ts.
  "src/core/welcome-text/welcome-text.constants.ts": [],
  // Targets of the planted imports: clean themselves.
  "src/server/tools/beta/beta.tool.ts": [],
  "src/core/xml/xml-escaper.ts": [],
  "src/core/kernel/names/slug/slug.ts": [],
  // Clean by rule: a class file loose in its topic folder; two parameters on one line.
  "src/server/app/loose-class.ts": [],
  "src/core/two-params/two-params.ts": [],
  // Clean by rule: a callback argument keeps its parameters on one line.
  "src/core/callback-params/callback-params.ts": [],
};

/** The repo's ESLint config; project-structure takes its root from the folder above node_modules, so it moves here. */
async function samplesConfig(): Promise<Linter.Config[]> {
  const projectRoot = relative(ROOT, SAMPLES);
  const repoConfig: { default: Linter.Config[] } = await import(`${ROOT}eslint.config.js`);

  return repoConfig.default.map((entry) => {
    if (entry.rules === undefined) {
      return entry;
    }

    const rules = Object.entries(entry.rules).map(([name, setting]) =>
      name.startsWith("project-structure/") && Array.isArray(setting)
        ? [name, [setting[0], Object.assign({}, setting[1], { projectRoot })]]
        : [name, setting],
    );

    return { ...entry, rules: Object.fromEntries(rules) };
  });
}

async function eslintFindings(): Promise<Map<string, Set<string>>> {
  const eslint = new ESLint({ cwd: SAMPLES, overrideConfigFile: true, baseConfig: await samplesConfig() });
  const findings = new Map<string, Set<string>>();

  for (const result of await eslint.lintFiles(["src", "test"])) {
    // Errors only: a rule turned down to a warning no longer refuses anything, so its case fails.
    const errors = result.messages.filter((message) => message.severity === 2);
    const rules = errors.map((message) => message.ruleId ?? `fatal: ${message.message}`);

    findings.set(relative(SAMPLES, result.filePath), new Set(rules));
  }

  return findings;
}

async function addDepcruiseFindings(findings: Map<string, Set<string>>): Promise<void> {
  const options = await extractDepcruiseOptions(`${ROOT}.dependency-cruiser.cjs`);
  // From samples/, as pnpm check:deps runs from the repo root: the config's tsconfig.json and the @/ it maps resolve
  // against the cwd, so the planted @/ imports reach samples/src.
  const cwd = process.cwd();

  process.chdir(SAMPLES);

  const { output } = await cruise(["src"], { ...options, baseDir: SAMPLES }).finally(() => process.chdir(cwd));

  if (typeof output === "string") {
    throw new Error(`dependency-cruiser returned text: ${output}`);
  }

  for (const violation of output.summary.violations) {
    const rules = findings.get(violation.from) ?? new Set<string>();

    findings.set(violation.from, rules.add(violation.rule.name));
  }
}

describe("guard rails refuse each planted sample with exactly its rules", () => {
  let found = new Map<string, string[]>();

  beforeAll(async () => {
    const findings = await eslintFindings();

    await addDepcruiseFindings(findings);
    found = new Map([...findings].map(([file, rules]) => [file, [...rules].sort()]));
  });

  it("checks exactly the planted files", () => {
    expect([...found.keys()].sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.entries(EXPECTED))("%s", (file, rules) => {
    expect(found.get(file)).toEqual([...rules].sort());
  });
});

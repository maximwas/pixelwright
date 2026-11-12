// Part of pnpm lint: tracked code and comments carry no personal or client names (playbook 4.3). Product documents
// (README, CHANGELOG, LICENSE, docs/) and data copied from old/ are not code, so they are not read.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { namesIn } from "./names/names-in.ts";

const CODE = ["src", "scripts", "test", ":(glob)*.ts", ":(glob)*.js", ":(glob)*.cjs"];
const DATA = ["test/golden/fixtures", "test/golden/__golden__", "test/golden/cases"].map((path) => `:(exclude)${path}`);
const listed = execFileSync("git", ["ls-files", "-z", "--", ...CODE, ...DATA], { encoding: "utf8" });
const files = listed.split("\0").filter(Boolean);
const found = files.flatMap((file) =>
  namesIn(readFileSync(file, "utf8")).map(({ line, word }) => `${file}:${line}: ${word}`),
);

if (found.length > 0) {
  console.error(`Names in tracked code: keep them in chat and local notes.\n${found.join("\n")}`);
  process.exitCode = 1;
}

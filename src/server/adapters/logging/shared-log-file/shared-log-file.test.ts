import { existsSync, mkdtempSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOG_FILE_MAX_BYTES } from "@/server/adapters/logging/shared-log-file/shared-log-file.constants.ts";
import { SharedLogFile } from "@/server/adapters/logging/shared-log-file/shared-log-file.ts";

class LogFolder {
  readonly root = mkdtempSync(join(tmpdir(), "pixelwright-log-"));
  readonly file = join(this.root, "logs", "pixelwright.log");

  open(): SharedLogFile {
    return new SharedLogFile({
      level: "info",
      file: this.file,
    });
  }

  text(path = this.file): string {
    return readFileSync(path, "utf8");
  }
}

describe("SharedLogFile", () => {
  it("opens nothing until its first line: building it touches no file", () => {
    const folder = new LogFolder();
    const log = folder.open();

    expect(existsSync(join(folder.root, "logs"))).toBe(false);
    log.write("first\n");
    expect(folder.text()).toBe("first\n");
  });

  it("appends lines to a file only the owner may read, in a folder only the owner may open", () => {
    const folder = new LogFolder();
    const log = folder.open();

    log.write("one\n");
    log.write("two\n");

    expect(folder.text()).toBe("one\ntwo\n");
    expect(statSync(folder.file).mode & 0o777).toBe(0o600);
    expect(statSync(join(folder.root, "logs")).mode & 0o777).toBe(0o700);
  });

  it("sets a file past 5 MiB aside as .1 at the next line, whichever process writes it", () => {
    const folder = new LogFolder();
    const log = folder.open();

    log.write("before\n");
    writeFileSync(folder.file, "x".repeat(LOG_FILE_MAX_BYTES + 1));
    log.write("after\n");

    expect(folder.text()).toBe("after\n");
    expect(statSync(`${folder.file}.1`).size).toBe(LOG_FILE_MAX_BYTES + 1);
  });

  it("follows a file another process set aside, so every server writes where `pixelwright logs` reads", () => {
    const folder = new LogFolder();
    const log = folder.open();

    log.write("before\n");
    renameSync(folder.file, `${folder.file}.1`);
    log.write("after\n");

    expect(folder.text()).toBe("after\n");
    expect(folder.text(`${folder.file}.1`)).toBe("before\n");
  });

  it("drops lines quietly when the file cannot be opened: stderr still has them", () => {
    const folder = new LogFolder();

    writeFileSync(join(folder.root, "logs"), "a file where the folder should be");

    expect(folder.open().write("lost\n")).toBe(true);
  });
});

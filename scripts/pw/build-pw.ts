// `pnpm build:pw`: types_read's answer types (src/server/tools/types-read/data/answer-types.json) from the read tools'
// output schemas, and the sandbox's utils bundled (src/server/adapters/sandbox/data/pw-utils.json). Run it after a
// read's output or the guest's code changes: answer-types.test.ts and guest-bundle.test.ts fail until then.
import { AnswerTypes } from "./answer-types.ts";
import { GuestBundle } from "./guest-bundle.ts";

await new AnswerTypes().write();
await new GuestBundle().write();

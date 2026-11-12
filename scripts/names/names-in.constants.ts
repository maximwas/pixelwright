/**
 * SHA-256 of each lower-cased personal or client name that tracked code must not carry (playbook 4.3). Hashed, so the
 * list itself names nobody in a public repository. Add one with
 * `node -e 'console.log(require("node:crypto").createHash("sha256").update("<lower-cased name>").digest("hex"))'`.
 */
export const NAME_HASHES: ReadonlySet<string> = new Set([
  "e7462a4f5295b5001cdb93eb3d6c65775910324ce38faacdf9e19403f4a3ca43",
  "d3fa5b799e2465cb0fae14bd4c9f0c21401ba9e548ab5d2d29ed811fbf99f93c",
  "6087c6f3f7022d8f70dde6bcb3b7415a3c1ad148b156207a78d61b039b3cfe10",
  "c05f7f34925c557b9d3ae30665f85e1f3520f7f9fedd610ed7b6e06860bcd9ea",
  "f661d4d0d6950c161caeeb5ffe582472688b3fc5482f207c844266cf9496b02a",
  "9f9f061941ce79c7f1cba0b323126b92f653a6cdba8ddfdf1dce01a83de01eb9",
  "ceb090c5ddc08574c92ff7786b8479e3600ce2db88ab1c6d539c6469b83a7d30",
  "ab291d93fb7df2cc9b38283b43dde1e20402afd0bd301dab937d139c2cad9210",
  "25d6a8e23e9a8db3fb55f82929b67f3344fd3269f1b58c7511a418f3aa6f0189",
  "6220fbf36844f8baf2732b57bcfcaf8705ab22c9297a7d0063f87985d9531d8c",
  "2a56c9e6919572fa7697464d8f5010f5a2b2896dc25a9978bcffdbb8bec1a095",
  "09a5714361b9cdba0d8da7efa2a463a21ad239a4a97a0852b68cd8b3b82c12e5",
  "e3686a913ca58ea80dde6f355d2222b6f75b2e9dc3daef4f3acf28e16102e92c",
  "6836b325b79323269b5b6b7de097434f496c3fcceb3787d089809eac350ecaad",
]);

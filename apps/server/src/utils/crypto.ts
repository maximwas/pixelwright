import { createHash, timingSafeEqual } from "node:crypto";

const sha256 = (value: string) => createHash("sha256").update(value).digest();

// Hashing first gives equal lengths, which timingSafeEqual requires, without leaking the real length.
export const tokenEquals = (received: string, expected: string) => timingSafeEqual(sha256(received), sha256(expected));

import { PROTOCOL_REASON_TEXT } from "@/shared/protocol/protocol.constants.ts";

/**
 * The close reason of a 4426 (S-004), a value object: `protocol N required`, naming the protocol the closing side
 * speaks. Every version writes it the same way, so the other side can tell whether it is the older or the newer one: a
 * plugin keeps retrying an older server and stops for a newer one (memory d9640dee).
 */
export class ProtocolReason {
  readonly protocol: number;

  private constructor(protocol: number) {
    this.protocol = protocol;
  }

  /** The reason a side that speaks `protocol` gives. */
  static required(protocol: number): ProtocolReason {
    return new ProtocolReason(protocol);
  }

  /** The reason the other side closed with, or null for any other close reason. */
  static parse(reason: string | null): ProtocolReason | null {
    const match = reason === null ? null : PROTOCOL_REASON_TEXT.pattern.exec(reason);

    return match === null ? null : new ProtocolReason(Number(match[1]));
  }

  text(): string {
    return PROTOCOL_REASON_TEXT.required(this.protocol);
  }
}

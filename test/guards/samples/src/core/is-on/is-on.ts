// Planted: a boolean compared with true. Refused by no-restricted-syntax.
export class Switch {
  isOn(flag: boolean | undefined): boolean {
    return flag === true;
  }
}

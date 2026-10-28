/** A damped spring as Figma's prototype springs are given: mass, stiffness, damping, and the speed it starts with. */
export interface PhysicalSpring {
  readonly mass: number;
  readonly stiffness: number;
  readonly damping: number;
  readonly initialVelocity?: number | undefined;
}

/** How close a spring must come to rest to count as settled: a thousandth of the distance. */
const AT_REST = 0.001;

/** The longest a spring is followed, in seconds: a spring with almost no damping still ends. */
const LONGEST = 30;

/**
 * A spring released one unit from its target (m·x″ + c·x′ + k·x = 0): how far it is from the target at a time, and
 * when it settles. The same motion whether Figma gave it physically or, as Motion does, as a bounce over a duration.
 */
export class SpringMotion {
  /** The undamped angular frequency, √(k/m). */
  readonly #omega: number;
  /** The damping ratio, c / (2√(km)): below 1 it overshoots, at 1 and above it does not. */
  readonly #zeta: number;
  /** The speed it starts with, toward the target. */
  readonly #velocity: number;

  private constructor(omega: number, zeta: number, velocity: number) {
    this.#omega = omega;
    this.#zeta = zeta;
    this.#velocity = velocity;
  }

  static physical({ mass, stiffness, damping, initialVelocity = 0 }: PhysicalSpring): SpringMotion {
    return new SpringMotion(Math.sqrt(stiffness / mass), damping / (2 * Math.sqrt(stiffness * mass)), initialVelocity);
  }

  /**
   * Motion's normalized spring over a duration of 1: one swing takes the whole duration, and the bounce (0 to 1) takes
   * damping away, a bounce of 0 being critically damped.
   */
  static normalized(bounce: number): SpringMotion {
    return new SpringMotion(2 * Math.PI, 1 - Math.min(1, Math.max(0, bounce)), 0);
  }

  /** The distance from the target at time t: 1 at the start, 0 at rest, below 0 past the target. */
  displacement(t: number): number {
    const omega = this.#omega;
    const zeta = this.#zeta;

    if (zeta < 1) {
      const damped = omega * Math.sqrt(1 - zeta * zeta);
      const sine = (zeta * omega - this.#velocity) / damped;

      return Math.exp(-zeta * omega * t) * (Math.cos(damped * t) + sine * Math.sin(damped * t));
    }

    if (zeta === 1) {
      return (1 + (omega - this.#velocity) * t) * Math.exp(-omega * t);
    }

    const root = omega * Math.sqrt(zeta * zeta - 1);
    const [fast, slow] = [-zeta * omega - root, -zeta * omega + root];
    const fastShare = (-this.#velocity - slow) / (fast - slow);

    return (1 - fastShare) * Math.exp(slow * t) + fastShare * Math.exp(fast * t);
  }

  /** When the spring comes to rest: the first time from which it stays within AT_REST of its target. */
  settleTime(): number {
    const step = 1 / 600;
    let settled = 0;

    for (let t = 0; t <= LONGEST; t += step) {
      if (Math.abs(this.displacement(t)) > AT_REST) {
        settled = t + step;
      }
    }

    return Math.min(settled, LONGEST);
  }
}

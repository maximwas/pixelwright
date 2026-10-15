import { CheckIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "./Badge";

interface PlanCardProps {
  readonly name: string;
  readonly price: string;
  readonly description: string;
  /** The Popular boolean property: the badge and the brand border. */
  readonly popular?: boolean;
  /** The Button the card exposes. */
  readonly children: ReactNode;
}

const FEATURES = ["Unlimited projects", "Version history for 30 days", "Email support"];

/** Orbit's pricing card: the Plan Card component, its Name, Price, Description and Popular properties as props. */
export function PlanCard({ name, price, description, popular = false, children }: PlanCardProps) {
  return (
    <article className={popular ? "plan-card plan-card--popular" : "plan-card"}>
      <header className="plan-card__header">
        <h3 className="plan-card__name">{name}</h3>
        {popular && <Badge>Popular</Badge>}
      </header>
      <p className="plan-card__description">{description}</p>
      <p className="plan-card__price">
        <span className="plan-card__amount">{price}</span> / month
      </p>
      {children}
      <ul className="plan-card__features">
        {FEATURES.map((feature) => (
          <li key={feature}>
            <CheckIcon size={20} aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>
    </article>
  );
}

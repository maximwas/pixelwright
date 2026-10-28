import { Button } from "../components/Button";
import { Callout } from "../components/Callout";
import { PlanCard } from "../components/PlanCard";

/**
 * The Plans row of Pricing – Desktop and the Callout under it, as design_read gives them with the Code Connect files:
 * each card and button is the project's component, written as the templates and batch rows render them.
 */
export function Pricing() {
  return (
    <main className="pricing">
      <section className="plans" aria-label="Plans">
        <PlanCard name="Starter" price="$0" description="For side projects and trying things out.">
          <Button variant="primary">Start free</Button>
        </PlanCard>
        <PlanCard name="Pro" price="$12" description="For freelancers shipping fast." popular>
          <Button variant="primary">Get started</Button>
        </PlanCard>
        <PlanCard name="Team" price="$29" description="For growing teams that ship together.">
          <Button variant="primary">Contact sales</Button>
        </PlanCard>
      </section>
      <Callout
        title="Need more than 50 seats?"
        body="Talk to us about volume pricing, SSO and a dedicated success manager."
      >
        <Button variant="primary">Talk to sales</Button>
        <Button variant="secondary">Compare plans</Button>
      </Callout>
      <p className="footnote">Prices in USD. Taxes may apply.</p>
    </main>
  );
}

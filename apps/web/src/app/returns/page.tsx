import { brand } from "@autoparts/shared";
import { LegalPage } from "../../components/legal-page";

export default function ReturnsPage() {
  return (
    <LegalPage title={`${brand.shortName} Returns & Refunds Policy`} lastUpdated="September 2026">
      <section>
        <h2>1. Refunds happen between you and the supplier</h2>
        <p>
          Because your payment goes directly to the supplier&apos;s own payment account — {brand.shortName} never
          holds it — a refund is something the supplier issues, not something we process centrally. If
          something&apos;s wrong with an order, start by contacting the supplier directly (their contact details are
          on your order).
        </p>
      </section>

      <section>
        <h2>2. Before you&apos;ve paid</h2>
        <p>
          An order sits reserved for a short window while awaiting payment. If you change your mind before paying,
          you can cancel it yourself from your orders page — no need to contact anyone.
        </p>
      </section>

      <section>
        <h2>3. Wrong, damaged, or not-as-described parts</h2>
        <p>Contact the supplier as soon as you notice the problem, with:</p>
        <ul>
          <li>Your order number</li>
          <li>What&apos;s wrong (wrong part, damaged in transit, doesn&apos;t match the listing)</li>
          <li>A photo, if the issue is visible</li>
        </ul>
        <p>A good-faith supplier should offer a replacement, exchange, or refund for a genuine error on their end.</p>
      </section>

      <section>
        <h2>4. Used and refurbished parts</h2>
        <p>
          Used, refurbished, and reconditioned parts are sold in the condition described on the listing — normal
          wear consistent with that condition isn&apos;t grounds for a return. Compatibility is based on the
          vehicle information provided at listing time; double-check fitment with the supplier before ordering if
          you&apos;re unsure.
        </p>
      </section>

      <section>
        <h2>5. Electrical and installed parts</h2>
        <p>
          As is standard in the auto parts trade, electrical components and parts that have already been installed
          are often non-returnable once fitted, since installation can be what caused a fault rather than the part
          itself. A supplier&apos;s specific policy on this may be noted on their listing or profile.
        </p>
      </section>

      <section>
        <h2>6. If you can&apos;t resolve it with the supplier</h2>
        <p>
          Reach out to us at [add a support email/phone here] with your order number and what happened. We can
          help facilitate contact and, where a supplier is repeatedly unresponsive or acting in bad faith, take
          that into account for their standing on the platform — but we can&apos;t reverse a payment made directly
          to a supplier&apos;s own account.
        </p>
      </section>
    </LegalPage>
  );
}

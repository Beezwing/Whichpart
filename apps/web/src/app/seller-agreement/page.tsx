import { brand } from "@autoparts/shared";
import { LegalPage } from "../../components/legal-page";

export default function SellerAgreementPage() {
  return (
    <LegalPage title={`${brand.shortName} Seller Agreement`} lastUpdated="September 2026">
      <p className="text-[var(--muted)]">
        This applies to you in addition to the general{" "}
        <a href="/terms" className="text-[var(--accent)] hover:underline">
          Terms of Service
        </a>{" "}
        if you sell on {brand.shortName} as a supplier.
      </p>

      <section>
        <h2>1. Verification</h2>
        <p>
          Before your account can list products, you&apos;ll submit proof of business registration and
          representative ID, and our team reviews and approves the application. We can request more information, or
          decline an application, at our discretion. Once approved, your legal business name and registration
          number are locked — contact us if either genuinely needs to change.
        </p>
      </section>

      <section>
        <h2>2. Your listings are your responsibility</h2>
        <p>You&apos;re responsible for the accuracy of everything you list:</p>
        <ul>
          <li>Price, quantity, and SKU — these are always exactly what you set. AI never touches them.</li>
          <li>Condition — new, used, refurbished, reconditioned, OEM, or aftermarket, honestly stated</li>
          <li>Vehicle fitment/compatibility information</li>
          <li>Photos that genuinely represent the item for sale</li>
        </ul>
        <p>
          AI may suggest a category or a cleaned-up description for a listing missing one — you approve or dismiss
          every suggestion yourself before it takes effect.
        </p>
      </section>

      <section>
        <h2>3. Payment goes directly to you</h2>
        <p>
          You connect your own LuniPay, Fygaro, or DimePay account. Customer payments go there directly —{" "}
          {brand.shortName} never holds, custodies, or takes a cut of your sale proceeds. That also means you&apos;re
          responsible for your own payment provider&apos;s fees, settlement times, and any tax obligations (GCT or
          otherwise) on your sales — none of that runs through us.
        </p>
        <p>
          During this pilot phase, order status (marking an order paid, processing, ready, or delivered) is
          something you update by hand from your dashboard once you&apos;ve confirmed payment directly through your
          own provider — this system doesn&apos;t yet automatically verify a charge on your behalf.
        </p>
      </section>

      <section>
        <h2>4. Fulfillment</h2>
        <p>
          You set your own pickup and delivery options per location, including delivery fees for areas you&apos;re
          willing to cover. If an item is too large or heavy for a flat delivery fee to make sense (a complete
          engine, for example), mark it as needing a manual freight quote — customers will see it&apos;s
          pickup-or-contact-you only, not an automatic delivery price.
        </p>
      </section>

      <section>
        <h2>5. Cancellations and returns</h2>
        <p>
          See the{" "}
          <a href="/returns" className="text-[var(--accent)] hover:underline">
            Returns &amp; Refunds Policy
          </a>{" "}
          — as the seller, you&apos;re the one who handles a return or refund request for your own orders, since
          payment went to your own account.
        </p>
      </section>

      <section>
        <h2>6. Suspension</h2>
        <p>
          We can suspend or deactivate your account for a violation of this agreement, repeated customer complaints,
          fraudulent listings, or misuse of the platform — with an explanation, where practical, and a chance to
          respond.
        </p>
      </section>

      <section>
        <h2>7. Contact</h2>
        <p>Questions about selling on {brand.shortName}? Reach us at [add a support email/phone here].</p>
      </section>
    </LegalPage>
  );
}

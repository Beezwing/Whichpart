import { brand } from "@autoparts/shared";
import { LegalPage } from "../../components/legal-page";

export default function TermsPage() {
  return (
    <LegalPage title={`${brand.shortName} Terms of Service`} lastUpdated="September 2026">
      <section>
        <h2>1. What {brand.shortName} is</h2>
        <p>
          {brand.shortName} is a marketplace connecting customers in Jamaica with independent auto parts suppliers.
          We provide the platform — listings, search, checkout, and messaging between customers and suppliers. We
          are not the seller of any part listed here, and we are not a party to the sale between you and a supplier.
          {brand.shortName} is currently in a pilot phase with a small number of suppliers while we refine how the
          platform works.
        </p>
      </section>

      <section>
        <h2>2. Accounts</h2>
        <p>
          You need an account to check out, save vehicles, message a supplier, or sell as a supplier. You&apos;re
          responsible for keeping your login secure and for anything that happens under your account. Give us
          accurate information — a supplier account additionally requires a real business registration and a
          verified representative before it can go live, reviewed by our team.
        </p>
      </section>

      <section>
        <h2>3. Suppliers are independent businesses</h2>
        <p>
          Every supplier on {brand.shortName} is an independent business, not our employee or agent. They set their
          own prices, control their own inventory, and are responsible for the accuracy of their listings —
          condition (new, used, refurbished, reconditioned, OEM, or aftermarket), fitment, and availability. AI is
          used behind the scenes only to suggest a listing&apos;s category or tidy up its wording — it never sets or
          changes a price, quantity, or SKU, and every suggestion is reviewed and approved by the supplier before it
          affects anything you see.
        </p>
      </section>

      <section>
        <h2>4. Payment</h2>
        <p>
          When you pay for an order, that payment goes directly to the supplier&apos;s own connected payment
          provider (currently LuniPay, Fygaro, or DimePay) — {brand.shortName} does not hold, custody, or take a cut
          of your payment at checkout. Because of that, payment disputes (a charge that looks wrong, a refund
          request) are between you and the supplier in the first instance; we&apos;ll help facilitate contact but we
          don&apos;t control or reverse a charge made through a supplier&apos;s own payment account.
        </p>
      </section>

      <section>
        <h2>5. Delivery and pickup</h2>
        <p>
          Each supplier sets their own pickup and delivery options and fees for their own location(s). During this
          pilot phase that&apos;s typically pickup and/or a flat local delivery fee — we don&apos;t yet offer
          integrated third-party courier delivery (e.g. island-wide freight), though that&apos;s something we&apos;re
          actively looking into. Some oversized or heavy items (like complete engines) are marked as needing a
          manual delivery quote rather than an automatic price — for those, pickup or contacting the supplier
          directly is the way to arrange delivery.
        </p>
      </section>

      <section>
        <h2>6. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>List or attempt to buy stolen, counterfeit, or misrepresented parts</li>
          <li>Use the platform to harass, defraud, or mislead another user</li>
          <li>Try to circumvent supplier verification or payment account checks</li>
          <li>Scrape, reverse-engineer, or disrupt the platform&apos;s normal operation</li>
        </ul>
        <p>We can suspend or remove an account that does any of the above.</p>
      </section>

      <section>
        <h2>7. Limitation of liability</h2>
        <p>
          {brand.shortName} provides the platform &quot;as is.&quot; We don&apos;t guarantee a part&apos;s fitment,
          condition,
          or a supplier&apos;s ability to fulfill an order, and to the extent permitted by Jamaican law we aren&apos;t
          liable for losses arising from a transaction between a customer and a supplier. Nothing here limits any
          liability that can&apos;t legally be limited.
        </p>
      </section>

      <section>
        <h2>8. Changes</h2>
        <p>
          We may update these terms as the platform develops, especially during this pilot phase. We&apos;ll update
          the date at the top of this page when we do.
        </p>
      </section>

      <section>
        <h2>9. Governing law</h2>
        <p>These terms are governed by the laws of Jamaica.</p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>Questions about these terms? Reach us at [add a support email/phone here].</p>
      </section>
    </LegalPage>
  );
}

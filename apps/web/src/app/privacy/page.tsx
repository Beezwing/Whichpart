import { brand } from "@autoparts/shared";
import { LegalPage } from "../../components/legal-page";

export default function PrivacyPage() {
  return (
    <LegalPage title={`${brand.shortName} Privacy Policy`} lastUpdated="September 2026">
      <section>
        <h2>1. What we collect</h2>
        <p>Depending on how you use {brand.shortName}, we collect:</p>
        <ul>
          <li>
            <strong>Account details</strong> — name, email, phone, and (for suppliers) business name, registration
            number, and verification documents
          </li>
          <li>
            <strong>Order details</strong> — items purchased, delivery address, and a map pin location if you drop
            one for delivery
          </li>
          <li>
            <strong>Vehicles you save</strong> to your garage, and parts you wishlist, so search can be more useful
            to you
          </li>
          <li>
            <strong>Search terms, in aggregate only</strong> — we track how often a term is searched and whether it
            returned results, so we can see what customers are looking for that we don&apos;t have listed. This is
            never tied to your account, session, or IP address — it&apos;s a running count per search term, not a
            log of who searched what
          </li>
        </ul>
      </section>

      <section>
        <h2>2. What we don&apos;t collect</h2>
        <p>
          We never see or store your card number or payment credentials. When you pay a supplier, that goes directly
          through the supplier&apos;s own connected payment provider (LuniPay, Fygaro, or DimePay) — {brand.shortName}{" "}
          isn&apos;t in that data path.
        </p>
      </section>

      <section>
        <h2>3. How we use it</h2>
        <ul>
          <li>To create and run your account, and process your orders</li>
          <li>To show a supplier the orders and delivery details they need to fulfill them</li>
          <li>To let AI suggest a product&apos;s category or clean up its description — nothing else, and never automatically applied without the supplier&apos;s approval</li>
          <li>To improve search and the catalog, using aggregate, non-identifying search data</li>
          <li>To review and verify a supplier application before it can go live</li>
        </ul>
      </section>

      <section>
        <h2>4. Who we share it with</h2>
        <ul>
          <li>
            <strong>The supplier you order from</strong> — your name, phone, and delivery details, so they can
            fulfill your order
          </li>
          <li>
            <strong>Google Maps</strong> — the delivery address/pin you enter at checkout, to show and confirm a
            location
          </li>
          <li>
            <strong>Anthropic (Claude)</strong> — a product&apos;s name and description, when a supplier&apos;s
            listing needs an AI-suggested category. No customer or order data is sent here.
          </li>
          <li>
            <strong>Each supplier&apos;s own payment provider</strong> — directly, when you pay; {brand.shortName} is
            not
            an intermediary for that data
          </li>
        </ul>
        <p>We don&apos;t sell your data to anyone.</p>
      </section>

      <section>
        <h2>5. How long we keep it</h2>
        <p>
          We keep account and order data for as long as your account is active, and as needed to resolve any
          dispute or meet a legal obligation. You can ask us to delete your account and personal data at any time,
          subject to what we need to keep for legitimate business or legal reasons (e.g. order records for a
          supplier&apos;s tax purposes).
        </p>
      </section>

      <section>
        <h2>6. Your choices</h2>
        <ul>
          <li>Update your name, phone, or password from your account page at any time</li>
          <li>Remove a saved vehicle or wishlist item whenever you like</li>
          <li>Ask us to export or delete your personal data — contact us to request either</li>
        </ul>
      </section>

      <section>
        <h2>7. Security</h2>
        <p>
          Passwords are hashed, never stored in plain text. Sensitive account fields — like a supplier&apos;s payment
          provider API key — are encrypted at rest.
        </p>
      </section>

      <section>
        <h2>8. Children</h2>
        <p>{brand.shortName} isn&apos;t directed at children, and we don&apos;t knowingly collect data from anyone under 18.</p>
      </section>

      <section>
        <h2>9. Changes</h2>
        <p>We&apos;ll update the date at the top of this page whenever this policy changes.</p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>Questions about your data? Reach us at [add a support email/phone here].</p>
      </section>
    </LegalPage>
  );
}

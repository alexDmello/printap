import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Printap by Mellod",
  description:
    "Privacy Policy for Printap, covering data collection, usage, storage, and your rights under Indian data protection laws including the DPDPA 2023.",
};

export default function PrivacyPage() {
  const effectiveDate = "27 October 2026";

  return (
    <div className="min-h-screen bg-white text-zinc-950 font-sans selection:bg-zinc-900 selection:text-white">
      {/* ─── NAVIGATION BAR ─── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-zinc-200/90 transition-all">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <Link href="/" className="flex flex-col group">
            <span className="text-lg sm:text-xl font-black tracking-tight text-zinc-950 leading-none">
              Printap
            </span>
            <span className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase mt-0.5">
              by Mellod
            </span>
          </Link>
          <Link
            href="/"
            className="text-xs sm:text-sm font-bold text-zinc-600 hover:text-zinc-950 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* ─── CONTENT ─── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="space-y-3 mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm text-zinc-500 font-medium">
            Effective Date: {effectiveDate}
          </p>
        </div>

        <div className="prose-custom space-y-8">
          {/* 1. Overview */}
          <section>
            <h2>1. Overview</h2>
            <p>
              This Privacy Policy describes how <strong>Mellod</strong> (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;),
              operating the <strong>Printap</strong> platform, collects, uses, stores, and
              protects personal data and information. This policy applies to all users of the
              Printap website (mellod.in and its subdomains), the Printap desktop application
              (&quot;Shop Agent&quot;), and all related services.
            </p>
            <p>
              This policy is published in compliance with:
            </p>
            <ul>
              <li>
                Information Technology Act, 2000 (&quot;IT Act&quot;)
              </li>
              <li>
                Information Technology (Reasonable Security Practices and Procedures and
                Sensitive Personal Data or Information) Rules, 2011 (&quot;SPDI Rules&quot;)
              </li>
              <li>
                Digital Personal Data Protection Act, 2023 (&quot;DPDPA&quot;)
              </li>
              <li>
                Information Technology (Intermediary Guidelines and Digital Media Ethics Code)
                Rules, 2021
              </li>
            </ul>
          </section>

          {/* 2. Data We Collect */}
          <section>
            <h2>2. Data We Collect</h2>

            <h3>2.1 From Customers (Persons Using the Print Service)</h3>
            <p>
              Printap is designed with a <strong>privacy-first</strong> architecture for
              customers. We collect <strong>minimal to no personal information</strong> from
              customers:
            </p>
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 my-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
                    <th className="pb-3 font-bold">Data</th>
                    <th className="pb-3 font-bold">Collected?</th>
                    <th className="pb-3 font-bold">Details</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-800 font-medium">
                  <tr className="border-t border-zinc-100">
                    <td className="py-2.5">Name</td>
                    <td className="py-2.5">❌ No</td>
                    <td className="py-2.5">Not requested from customers</td>
                  </tr>
                  <tr className="border-t border-zinc-100">
                    <td className="py-2.5">Phone Number</td>
                    <td className="py-2.5">❌ No</td>
                    <td className="py-2.5">Not requested from customers</td>
                  </tr>
                  <tr className="border-t border-zinc-100">
                    <td className="py-2.5">Email Address</td>
                    <td className="py-2.5">❌ No</td>
                    <td className="py-2.5">Not requested from customers</td>
                  </tr>
                  <tr className="border-t border-zinc-100">
                    <td className="py-2.5">Documents / Files</td>
                    <td className="py-2.5">❌ No (not stored)</td>
                    <td className="py-2.5">
                      Streamed via encrypted WebRTC P2P directly to the shop&apos;s
                      local computer. <strong>Never uploaded to or stored on any server.</strong>{" "}
                      Memory buffers are zeroed immediately after the print spooler receives the file.
                    </td>
                  </tr>
                  <tr className="border-t border-zinc-100">
                    <td className="py-2.5">Session ID</td>
                    <td className="py-2.5">✅ Yes</td>
                    <td className="py-2.5">
                      An opaque, anonymous session identifier generated for the WebRTC
                      handshake. Contains no personal information.
                    </td>
                  </tr>
                  <tr className="border-t border-zinc-100">
                    <td className="py-2.5">Payment Details</td>
                    <td className="py-2.5">❌ No</td>
                    <td className="py-2.5">
                      UPI payments go directly from customer to shopkeeper via the customer&apos;s
                      UPI app. Printap never sees bank details, UPI PINs, or transaction IDs.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>2.2 From Shop Owners (Registered Users)</h3>
            <p>
              To register a shop on Printap, we collect the following information:
            </p>
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 my-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
                    <th className="pb-3 font-bold">Data</th>
                    <th className="pb-3 font-bold">Purpose</th>
                    <th className="pb-3 font-bold">Legal Basis</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-800 font-medium">
                  <tr className="border-t border-zinc-100">
                    <td className="py-2.5">Full Name</td>
                    <td className="py-2.5">Account identification and display</td>
                    <td className="py-2.5">Contract performance</td>
                  </tr>
                  <tr className="border-t border-zinc-100">
                    <td className="py-2.5">Email Address</td>
                    <td className="py-2.5">Google OAuth authentication, account recovery, and platform communications</td>
                    <td className="py-2.5">Contract performance, Consent (via Google OAuth)</td>
                  </tr>
                  <tr className="border-t border-zinc-100">
                    <td className="py-2.5">Phone Number</td>
                    <td className="py-2.5">Account verification, support contact</td>
                    <td className="py-2.5">Consent</td>
                  </tr>
                  <tr className="border-t border-zinc-100">
                    <td className="py-2.5">Shop Name &amp; Slug</td>
                    <td className="py-2.5">Public-facing shop identity and subdomain routing</td>
                    <td className="py-2.5">Contract performance</td>
                  </tr>
                  <tr className="border-t border-zinc-100">
                    <td className="py-2.5">UPI VPA</td>
                    <td className="py-2.5">Generating UPI payment QR codes for customers to pay the shopkeeper directly</td>
                    <td className="py-2.5">Contract performance</td>
                  </tr>
                  <tr className="border-t border-zinc-100">
                    <td className="py-2.5">Shop Location (Address, Lat/Lng, City, State, Pincode)</td>
                    <td className="py-2.5">Enabling customers to find nearby shops (future feature), operational analytics</td>
                    <td className="py-2.5">Consent</td>
                  </tr>
                  <tr className="border-t border-zinc-100">
                    <td className="py-2.5">Password (hashed)</td>
                    <td className="py-2.5">Desktop agent terminal authentication</td>
                    <td className="py-2.5">Contract performance</td>
                  </tr>
                  <tr className="border-t border-zinc-100">
                    <td className="py-2.5">Google Profile Picture</td>
                    <td className="py-2.5">Display in onboard confirmation (not stored permanently)</td>
                    <td className="py-2.5">Consent</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>2.3 Automatically Collected Information</h3>
            <ul>
              <li>
                <strong>Print Events:</strong> An anonymous log of each completed print session
                (shop ID, session ID, fee amount, timestamp). This is used for billing and
                audit purposes. No document content or customer identity is stored.
              </li>
              <li>
                <strong>Browser/Device Information:</strong> Standard HTTP headers (browser type,
                device type, IP address) processed transiently during request handling. We do
                not persistently log IP addresses.
              </li>
            </ul>
          </section>

          {/* 3. How We Use Your Data */}
          <section>
            <h2>3. How We Use Your Data</h2>
            <p>We use the collected data exclusively for:</p>
            <ul>
              <li>Providing, maintaining, and improving the Printap platform.</li>
              <li>Authenticating shop owners and managing their accounts.</li>
              <li>Generating UPI payment QR codes for customer transactions.</li>
              <li>Routing print sessions to the correct shop via subdomain.</li>
              <li>Recording print event ledger entries for billing and invoicing.</li>
              <li>Communicating important platform updates, policy changes, or security alerts.</li>
              <li>Complying with legal obligations and responding to lawful requests from authorities.</li>
            </ul>
            <p>
              We <strong>do not</strong> sell, rent, trade, or share your personal data with
              third-party advertisers, data brokers, or marketing companies.
            </p>
          </section>

          {/* 4. Data Storage & Security */}
          <section>
            <h2>4. Data Storage and Security</h2>
            <ul>
              <li>
                Shop owner data is stored in a <strong>Supabase</strong> (PostgreSQL) database
                hosted on secure cloud infrastructure with Row Level Security (RLS) enabled.
              </li>
              <li>
                Passwords are <strong>hashed</strong> before storage and are never stored in
                plaintext.
              </li>
              <li>
                All data in transit is encrypted using TLS 1.2+ (HTTPS) and WebRTC
                DTLS/SRTP for peer-to-peer document streams.
              </li>
              <li>
                Administrative access to the database is protected by service-role
                authentication and admin secrets.
              </li>
              <li>
                Customer documents are <strong>never stored</strong> on any server. They exist
                only in volatile memory during the P2P transfer and are immediately zeroed
                after printing.
              </li>
            </ul>
            <p>
              We implement reasonable security practices and procedures as required under the
              SPDI Rules and the IT Act. However, no method of transmission over the Internet
              or method of electronic storage is 100% secure, and we cannot guarantee absolute
              security.
            </p>
          </section>

          {/* 5. Data Retention */}
          <section>
            <h2>5. Data Retention</h2>
            <ul>
              <li>
                <strong>Shop owner data:</strong> Retained for as long as the shop account is
                active, and for a reasonable period thereafter as required by applicable laws
                (e.g., tax/accounting records may be retained for up to 8 years).
              </li>
              <li>
                <strong>Print event logs:</strong> Retained for billing and audit purposes for a
                period of up to 3 years.
              </li>
              <li>
                <strong>Customer documents:</strong> Zero retention. Documents are not stored on
                any server or device beyond the immediate print session.
              </li>
              <li>
                <strong>Authentication sessions:</strong> Login sessions expire automatically
                after the configured timeout period.
              </li>
            </ul>
          </section>

          {/* 6. Third-Party Services */}
          <section>
            <h2>6. Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul>
              <li>
                <strong>Supabase:</strong> Database hosting, authentication, and real-time
                signaling infrastructure.{" "}
                <a
                  href="https://supabase.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-950 font-bold underline underline-offset-4"
                >
                  Supabase Privacy Policy
                </a>
              </li>
              <li>
                <strong>Google OAuth:</strong> Used for shop owner authentication.{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-950 font-bold underline underline-offset-4"
                >
                  Google Privacy Policy
                </a>
              </li>
              <li>
                <strong>Resend:</strong> Email delivery service for account-related
                communications.{" "}
                <a
                  href="https://resend.com/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-950 font-bold underline underline-offset-4"
                >
                  Resend Privacy Policy
                </a>
              </li>
              <li>
                <strong>Vercel:</strong> Web application hosting and deployment.{" "}
                <a
                  href="https://vercel.com/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-950 font-bold underline underline-offset-4"
                >
                  Vercel Privacy Policy
                </a>
              </li>
            </ul>
            <p>
              We do <strong>not</strong> use Google Analytics, Facebook Pixel, or any
              third-party advertising or tracking services.
            </p>
          </section>

          {/* 7. Your Rights */}
          <section>
            <h2>7. Your Rights</h2>
            <p>
              Under the Digital Personal Data Protection Act, 2023 (DPDPA) and applicable
              Indian law, you have the following rights:
            </p>
            <ul>
              <li>
                <strong>Right to Access:</strong> You may request a summary of your personal data
                processed by us.
              </li>
              <li>
                <strong>Right to Correction:</strong> You may request correction of inaccurate
                or incomplete personal data.
              </li>
              <li>
                <strong>Right to Erasure:</strong> You may request deletion of your personal data,
                subject to our legal obligations to retain certain records.
              </li>
              <li>
                <strong>Right to Withdraw Consent:</strong> Where processing is based on consent,
                you may withdraw consent at any time. This may result in the inability to
                continue using certain features of the Platform.
              </li>
              <li>
                <strong>Right to Grievance Redressal:</strong> You may contact our Grievance
                Officer for any privacy-related concerns.
              </li>
              <li>
                <strong>Right to Nominate:</strong> Under the DPDPA, you have the right to
                nominate a person to exercise your data rights in case of your death or
                incapacity.
              </li>
            </ul>
            <p>
              To exercise any of these rights, please contact our Grievance Officer at the
              details provided on our{" "}
              <Link href="/contact" className="text-zinc-950 font-bold underline underline-offset-4">
                Contact
              </Link>{" "}
              page.
            </p>
          </section>

          {/* 8. Children's Privacy */}
          <section>
            <h2>8. Children&apos;s Privacy</h2>
            <p>
              The Shop Owner registration is not intended for individuals under 18 years of age.
              We do not knowingly collect personal data from children under 18 for the purpose
              of shop registration. The customer-facing print service does not collect any
              personal data and may be used by minors under parental supervision.
            </p>
            <p>
              If we become aware that personal data of a child under 18 has been collected
              without verifiable parental consent, we will take steps to delete such
              information.
            </p>
          </section>

          {/* 9. Data Breach Notification */}
          <section>
            <h2>9. Data Breach Notification</h2>
            <p>
              In the event of a personal data breach that may affect your rights and
              interests, we will notify the Data Protection Board of India as required under
              the DPDPA and will inform affected users without unreasonable delay.
            </p>
          </section>

          {/* 10. Changes */}
          <section>
            <h2>10. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be
              communicated via email to registered shop owners and by updating the
              &quot;Effective Date&quot; at the top of this page. Continued use of the Platform after
              changes constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* 11. Contact */}
          <section>
            <h2>11. Grievance Officer and Contact</h2>
            <p>
              For any privacy-related queries, concerns, or to exercise your rights under this
              policy, please contact our Grievance Officer. Full details are available on our{" "}
              <Link href="/contact" className="text-zinc-950 font-bold underline underline-offset-4">
                Contact and Grievance Officer
              </Link>{" "}
              page.
            </p>
          </section>
        </div>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-zinc-200 py-10 px-4 sm:px-6 bg-white">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-zinc-500 font-medium">
          <div className="flex items-center gap-2.5">
            <img src="/P.png" alt="Printap" className="w-6 h-6 rounded-lg" />
            <span className="font-extrabold text-zinc-900 text-sm">Printap</span>
            <span>·</span>
            <span>Simple document printing for counters</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="hover:text-zinc-950 transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="text-zinc-950 font-bold">
              Privacy
            </Link>
            <Link href="/refund-policy" className="hover:text-zinc-950 transition-colors">
              Refund Policy
            </Link>
            <Link href="/contact" className="hover:text-zinc-950 transition-colors">
              Contact
            </Link>
          </div>
          <div>© {new Date().getFullYear()} Mellod. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}

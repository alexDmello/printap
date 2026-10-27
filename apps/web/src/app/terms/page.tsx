import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms and Conditions — Printap by Mellod",
  description:
    "Terms and Conditions governing the use of Printap, the decentralized peer-to-peer document printing platform by Mellod.",
};

export default function TermsPage() {
  const effectiveDate = "27 October 2026";

  return (
    <div className="min-h-screen bg-white text-zinc-950 font-sans selection:bg-zinc-900 selection:text-white">
      {/* ─── NAVIGATION BAR ─── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-zinc-200/90 transition-all">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src="/P.png"
              alt="Printap Logo"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl shadow-xs group-hover:scale-105 transition-transform"
            />
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-black tracking-tight text-zinc-950 leading-none">
                Printap
              </span>
              <span className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase mt-0.5">
                by Mellod
              </span>
            </div>
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
            Terms and Conditions
          </h1>
          <p className="text-sm text-zinc-500 font-medium">
            Effective Date: {effectiveDate}
          </p>
        </div>

        <div className="prose-custom space-y-8">
          {/* 1. Introduction */}
          <section>
            <h2>1. Introduction</h2>
            <p>
              Welcome to <strong>Printap</strong> (&quot;Platform&quot;, &quot;Service&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;),
              a product of <strong>Mellod</strong>. Printap is a decentralized peer-to-peer document
              printing network accessible via our website at{" "}
              <strong>mellod.in</strong> (including all subdomains), our desktop application
              (&quot;Shop Agent&quot;), and related services.
            </p>
            <p>
              By accessing or using any part of the Service, you (&quot;User&quot;, &quot;you&quot;, &quot;your&quot;)
              agree to be bound by these Terms and Conditions (&quot;Terms&quot;). If you do not agree
              to these Terms, you must not use the Service.
            </p>
            <p>
              These Terms are governed by and construed in accordance with the laws of
              India, including the Information Technology Act, 2000 (&quot;IT Act&quot;), the Indian
              Contract Act, 1872, and the Consumer Protection Act, 2019.
            </p>
          </section>

          {/* 2. Definitions */}
          <section>
            <h2>2. Definitions</h2>
            <ul>
              <li>
                <strong>&quot;Customer&quot;</strong> — Any person who uses the Platform to upload a
                document and have it printed at a registered shop.
              </li>
              <li>
                <strong>&quot;Shop Owner&quot; / &quot;Shopkeeper&quot;</strong> — Any person or entity that
                registers a print/xerox shop on the Platform to receive and print
                customer documents.
              </li>
              <li>
                <strong>&quot;Shop Agent&quot;</strong> — The Printap desktop application (Electron-based)
                installed on the shopkeeper&apos;s Windows computer.
              </li>
              <li>
                <strong>&quot;Print Session&quot;</strong> — A single instance of a customer uploading a
                document, paying, and having it printed at a registered shop.
              </li>
              <li>
                <strong>&quot;UPI&quot;</strong> — Unified Payments Interface, a real-time payment system
                regulated by the National Payments Corporation of India (NPCI).
              </li>
            </ul>
          </section>

          {/* 3. Eligibility */}
          <section>
            <h2>3. Eligibility</h2>
            <p>
              To use Printap as a <strong>Customer</strong>, no registration or age restriction
              applies beyond the general legal capacity to enter into contracts under Indian
              law (18 years of age). To register as a <strong>Shop Owner</strong>, you must:
            </p>
            <ul>
              <li>Be at least 18 years of age.</li>
              <li>Have a valid Google account for authentication.</li>
              <li>
                Have a valid UPI Virtual Payment Address (VPA) linked to a bank account.
              </li>
              <li>
                Operate a lawful print/xerox/copy shop or business in India.
              </li>
            </ul>
          </section>

          {/* 4. Nature of Service */}
          <section>
            <h2>4. Nature of Service — Intermediary Platform</h2>
            <p>
              Printap is an <strong>intermediary</strong> within the meaning of Section 2(1)(w)
              of the Information Technology Act, 2000. We provide the technology
              infrastructure that enables peer-to-peer document transfer between
              customers and shopkeepers. Specifically:
            </p>
            <ul>
              <li>
                Printap <strong>does not store</strong> customer documents on any cloud server. All
                files are streamed directly from the customer&apos;s device to the shop&apos;s
                computer via encrypted WebRTC DataChannels.
              </li>
              <li>
                Printap <strong>does not process, hold, or intermediate any payments</strong>. All
                UPI payments flow directly from the customer&apos;s bank to the shopkeeper&apos;s
                bank account. Printap has no access to, or control over, these funds.
              </li>
              <li>
                Printap <strong>does not provide printing services</strong>. The actual printing is
                performed by the shopkeeper using their own equipment.
              </li>
            </ul>
            <p>
              As an intermediary, Printap is entitled to the safe harbour protections
              under Section 79 of the IT Act, subject to compliance with the Information
              Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021
              (&quot;Intermediary Guidelines&quot;).
            </p>
          </section>

          {/* 5. User Obligations */}
          <section>
            <h2>5. User Obligations</h2>
            <h3>5.1 All Users</h3>
            <ul>
              <li>You shall not use the Platform for any purpose that is unlawful or prohibited by these Terms.</li>
              <li>You shall not attempt to gain unauthorized access to any portion of the Platform.</li>
              <li>You shall not interfere with or disrupt the integrity of the Platform.</li>
              <li>You shall provide accurate and complete information where required.</li>
            </ul>
            <h3>5.2 Customers</h3>
            <ul>
              <li>
                You are solely responsible for the content of documents you upload. You
                warrant that you have the right to print and reproduce such documents and
                that they do not violate any applicable laws, including copyright laws.
              </li>
              <li>
                You understand that documents are streamed directly to the shopkeeper&apos;s
                printer and that the shopkeeper may visually see the document on their
                screen during the printing process.
              </li>
            </ul>
            <h3>5.3 Shop Owners</h3>
            <ul>
              <li>
                You shall maintain a functional printer and computer with the latest version
                of the Shop Agent installed.
              </li>
              <li>
                You shall not store, copy, distribute, or misuse customer documents received
                through the Platform.
              </li>
              <li>
                You are solely responsible for the pricing you set for print services and for
                providing accurate UPI payment details.
              </li>
              <li>
                You shall comply with all applicable local laws, including business licenses
                and tax obligations (GST, if applicable).
              </li>
            </ul>
          </section>

          {/* 6. Acceptable Use Policy */}
          <section>
            <h2>6. Acceptable Use Policy</h2>
            <p>
              In accordance with the Intermediary Guidelines, you agree
              <strong> not to upload, transmit, or print</strong> any material that:
            </p>
            <ul>
              <li>
                Is defamatory, obscene, pornographic, paedophilic, invasive of another&apos;s
                privacy, or otherwise objectionable under Indian law.
              </li>
              <li>
                Infringes any patent, trademark, copyright, or other intellectual property right.
              </li>
              <li>
                Contains viruses, malware, or any computer code designed to disrupt or damage
                computer systems.
              </li>
              <li>
                Threatens the unity, integrity, defence, security, or sovereignty of India,
                friendly relations with foreign states, or public order.
              </li>
              <li>
                Deceives or misleads any person, including impersonation of another person.
              </li>
              <li>
                Violates any law for the time being in force, including but not limited to the
                Indian Penal Code, the Copyright Act 1957, and the IT Act 2000.
              </li>
              <li>
                Contains counterfeit currency, fake government documents, or forged official
                certificates.
              </li>
            </ul>
            <p>
              Violation of this Acceptable Use Policy may result in immediate termination of
              your access to the Platform and reporting to law enforcement authorities where
              required by law.
            </p>
          </section>

          {/* 7. Intellectual Property */}
          <section>
            <h2>7. Intellectual Property</h2>
            <p>
              All content, trademarks, logos, and software associated with Printap and Mellod
              are the exclusive property of Mellod. You may not reproduce, distribute, or
              create derivative works from any part of the Platform without prior written
              consent.
            </p>
            <p>
              Customer documents uploaded through the Platform remain the intellectual
              property of the customer. Printap claims no ownership or license over user-uploaded
              content.
            </p>
          </section>

          {/* 8. Payments & Commercial Terms */}
          <section>
            <h2>8. Payments and Commercial Terms</h2>
            <ul>
              <li>
                All payments are <strong>direct transactions</strong> between the customer and
                the shopkeeper via UPI or cash. Printap does not act as a payment
                aggregator, payment gateway, or escrow service.
              </li>
              <li>
                Printap currently charges <strong>zero platform fees</strong> from both customers
                and shop owners. This is subject to change with prior notice.
              </li>
              <li>
                Printap is <strong>not responsible</strong> for payment failures, UPI
                transaction issues, banking errors, or disputes between customers and
                shopkeepers regarding payments.
              </li>
              <li>
                For refund and cancellation related matters, please see our{" "}
                <Link href="/refund-policy" className="text-zinc-950 font-bold underline underline-offset-4">
                  Refund and Cancellation Policy
                </Link>.
              </li>
            </ul>
          </section>

          {/* 9. Disclaimer of Warranties */}
          <section>
            <h2>9. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT
              WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT
              LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p>Without limiting the foregoing, Printap does not warrant that:</p>
            <ul>
              <li>The Service will be uninterrupted, timely, secure, or error-free.</li>
              <li>Print quality, paper quality, or output accuracy will meet your expectations (these depend entirely on the shopkeeper&apos;s equipment).</li>
              <li>WebRTC connections will be established in all network environments.</li>
              <li>UPI payment transactions will be processed without error or delay.</li>
            </ul>
          </section>

          {/* 10. Limitation of Liability */}
          <section>
            <h2>10. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable Indian law, Mellod, its
              directors, employees, and agents shall not be liable for:
            </p>
            <ul>
              <li>
                Any indirect, incidental, special, consequential, or punitive damages arising
                out of or in connection with your use of the Service.
              </li>
              <li>
                Loss, corruption, or unauthorized access to documents during the peer-to-peer
                transfer process.
              </li>
              <li>
                Any actions, omissions, or negligence of shopkeepers, including but not
                limited to print quality, delayed service, document mishandling, or refusal
                of service.
              </li>
              <li>
                Payment disputes, UPI transaction failures, or incorrect payment amounts.
              </li>
              <li>
                Any harm resulting from viruses, malware, or security vulnerabilities in
                user-uploaded documents.
              </li>
            </ul>
            <p>
              In no event shall our total cumulative liability exceed ₹500 (Indian Rupees
              Five Hundred) or the amount paid by you for the specific transaction giving
              rise to the claim, whichever is lower.
            </p>
          </section>

          {/* 11. Indemnification */}
          <section>
            <h2>11. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Mellod, its officers,
              directors, employees, and agents from and against any claims, damages, losses,
              liabilities, costs, and expenses (including legal fees) arising out of or
              related to:
            </p>
            <ul>
              <li>Your violation of these Terms.</li>
              <li>Your violation of any law or the rights of any third party.</li>
              <li>Any content you upload or transmit through the Platform.</li>
              <li>Any dispute between a customer and a shopkeeper.</li>
            </ul>
          </section>

          {/* 12. Cookies & Tracking */}
          <section>
            <h2>12. Cookies and Tracking Technologies</h2>
            <p>
              Printap uses the following cookies and local storage mechanisms:
            </p>
            <ul>
              <li>
                <strong>Authentication Cookies:</strong> Set by Supabase Auth and Google OAuth to
                maintain your login session. These are essential for shop owner authentication
                and cannot be disabled.
              </li>
              <li>
                <strong>Session Storage:</strong> Used temporarily during a print session to
                maintain WebRTC connection state and print queue information. This data is
                cleared when the session ends or the browser tab is closed.
              </li>
              <li>
                <strong>Local Storage:</strong> Used to store non-sensitive preferences such as
                your session timeout countdown and UI preferences.
              </li>
            </ul>
            <p>
              We do <strong>not</strong> use advertising cookies, third-party tracking pixels,
              analytics cookies (e.g., Google Analytics), or cross-site trackers. Your
              browsing activity on Printap is not shared with any advertising networks.
            </p>
            <p>
              For more information on how we handle your personal data, please see our{" "}
              <Link href="/privacy" className="text-zinc-950 font-bold underline underline-offset-4">
                Privacy Policy
              </Link>.
            </p>
          </section>

          {/* 13. Termination */}
          <section>
            <h2>13. Termination</h2>
            <p>
              We may suspend or terminate your access to the Platform at any time, with or
              without cause, and with or without notice. Grounds for termination include but
              are not limited to:
            </p>
            <ul>
              <li>Violation of these Terms or the Acceptable Use Policy.</li>
              <li>Non-payment of platform dues (if applicable in the future).</li>
              <li>Receipt of a valid legal order from a competent authority.</li>
              <li>Fraudulent activity or misrepresentation.</li>
            </ul>
            <p>
              Shop Owners may delete their shop and account by contacting us at the details
              provided in our{" "}
              <Link href="/contact" className="text-zinc-950 font-bold underline underline-offset-4">
                Contact
              </Link>{" "}
              page.
            </p>
          </section>

          {/* 14. Governing Law & Dispute Resolution */}
          <section>
            <h2>14. Governing Law and Dispute Resolution</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of
              India. Any dispute arising out of or in connection with these Terms shall be
              subject to the exclusive jurisdiction of the courts in{" "}
              <strong>Mumbai, Maharashtra, India</strong>.
            </p>
            <p>
              Before initiating any legal proceedings, you agree to first attempt to resolve
              the dispute informally by contacting our Grievance Officer (details on our{" "}
              <Link href="/contact" className="text-zinc-950 font-bold underline underline-offset-4">
                Contact
              </Link>{" "}
              page) for a minimum period of 30 days.
            </p>
          </section>

          {/* 15. Changes to Terms */}
          <section>
            <h2>15. Changes to These Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. Material changes will
              be communicated via email to registered Shop Owners and by updating the
              &quot;Effective Date&quot; at the top of this page. Your continued use of the Platform
              after any changes constitutes acceptance of the revised Terms.
            </p>
          </section>

          {/* 16. Severability */}
          <section>
            <h2>16. Severability</h2>
            <p>
              If any provision of these Terms is held to be invalid or unenforceable by a
              court of competent jurisdiction, the remaining provisions shall continue in
              full force and effect.
            </p>
          </section>

          {/* 17. Contact */}
          <section>
            <h2>17. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at our{" "}
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
            <Link href="/terms" className="text-zinc-950 font-bold">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-zinc-950 transition-colors">
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

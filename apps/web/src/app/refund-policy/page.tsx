import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refund and Cancellation Policy — Printap by Mellod",
  description:
    "Refund and Cancellation Policy for Printap document printing platform, as required under the Consumer Protection (E-Commerce) Rules, 2020.",
};

export default function RefundPolicyPage() {
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
            Refund and Cancellation Policy
          </h1>
          <p className="text-sm text-zinc-500 font-medium">
            Effective Date: {effectiveDate}
          </p>
        </div>

        <div className="prose-custom space-y-8">
          {/* Important Notice */}
          <section>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <span className="text-amber-600 text-lg flex-shrink-0">⚠️</span>
                <div>
                  <h3 className="text-sm font-bold text-amber-900 mb-1">
                    Important: Printap Does Not Process Payments
                  </h3>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Printap is a technology platform that connects customers with print shops.
                    All payments (UPI or cash) flow <strong>directly between the customer and the
                    shopkeeper</strong>. Printap does not collect, hold, process, or intermediate
                    any payment. Therefore, Printap cannot directly issue refunds.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 1. Nature of Service */}
          <section>
            <h2>1. Nature of the Service</h2>
            <p>
              Printap provides a peer-to-peer document streaming and printing technology. The
              actual printing service is performed by independent, self-registered print shop
              owners using their own equipment. When a customer pays via UPI, the payment goes
              directly to the shopkeeper&apos;s bank account — Printap has no access to or
              control over these funds.
            </p>
          </section>

          {/* 2. Cancellation */}
          <section>
            <h2>2. Cancellation Before Printing</h2>
            <h3>2.1 Before Document Transfer</h3>
            <p>
              If you have not yet uploaded/streamed your document to the shop&apos;s printer,
              you may close the browser tab or navigate away at any time. No charges are
              incurred and no data is transmitted.
            </p>

            <h3>2.2 After Document Transfer but Before Payment</h3>
            <p>
              If you have streamed your document to the shop but have not yet completed UPI
              payment, you may choose not to pay. However, please note that the shopkeeper
              may have already received the document on their terminal. Communicate directly
              with the shop staff if you wish to cancel at this stage.
            </p>

            <h3>2.3 After Payment</h3>
            <p>
              Once payment has been made (via UPI or cash) and the document has been sent to
              the printer, the transaction is considered complete. Due to the instantaneous
              and irreversible nature of both UPI transfers and physical printing, standard
              cancellation is <strong>not possible</strong> after payment.
            </p>
          </section>

          {/* 3. Refund Scenarios */}
          <section>
            <h2>3. Refund Scenarios</h2>
            <p>
              Since all payments go directly to the shopkeeper, refunds must primarily be
              handled between the customer and the shopkeeper. The following scenarios
              describe the recommended course of action:
            </p>

            <div className="space-y-4 my-4">
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-zinc-900">
                  Scenario 1: Payment Made but Document Not Printed
                </h3>
                <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
                  If you made a UPI payment but the document was not printed due to a
                  technical failure (WebRTC disconnection, printer malfunction, etc.), you
                  should request a refund directly from the shopkeeper. Since the shopkeeper
                  received the payment in their bank account, they are the only party that can
                  initiate a refund.
                </p>
                <p className="text-xs text-zinc-800 font-bold mt-2">
                  Resolution: Request the shopkeeper to initiate a UPI refund or provide cash
                  equivalent.
                </p>
              </div>

              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-zinc-900">
                  Scenario 2: Poor Print Quality
                </h3>
                <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
                  Print quality depends entirely on the shopkeeper&apos;s equipment (printer
                  model, ink levels, paper quality). If you receive an unsatisfactory
                  printout, this is a matter between you and the shopkeeper.
                </p>
                <p className="text-xs text-zinc-800 font-bold mt-2">
                  Resolution: Discuss directly with the shop staff for a reprint or refund.
                </p>
              </div>

              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-zinc-900">
                  Scenario 3: Incorrect Number of Pages Printed
                </h3>
                <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
                  If the wrong number of pages, copies, or colour mode was printed, please
                  discuss with the shopkeeper. This may be due to settings selection error or
                  a printer configuration issue.
                </p>
                <p className="text-xs text-zinc-800 font-bold mt-2">
                  Resolution: The shopkeeper may offer a reprint at no additional charge at
                  their discretion.
                </p>
              </div>

              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-zinc-900">
                  Scenario 4: Double Payment (UPI Error)
                </h3>
                <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
                  If a UPI payment was debited twice or an incorrect amount was deducted, this
                  is a banking/UPI infrastructure issue. You should contact your bank or UPI
                  app provider (Google Pay, PhonePe, Paytm, BHIM, etc.) to raise a
                  transaction dispute.
                </p>
                <p className="text-xs text-zinc-800 font-bold mt-2">
                  Resolution: File a dispute with your bank/UPI app. You may also contact the
                  shopkeeper with the transaction reference number.
                </p>
              </div>

              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-zinc-900">
                  Scenario 5: Cash Payment Dispute
                </h3>
                <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
                  For cash transactions, all disputes regarding payment amounts, change, or
                  receipt of payment are strictly between the customer and the shopkeeper.
                  Printap has no visibility into or record of cash transactions.
                </p>
                <p className="text-xs text-zinc-800 font-bold mt-2">
                  Resolution: Resolve directly with the shopkeeper at the counter.
                </p>
              </div>
            </div>
          </section>

          {/* 4. Printap's Role */}
          <section>
            <h2>4. Printap&apos;s Role in Dispute Resolution</h2>
            <p>
              While Printap does not process payments and therefore cannot directly issue
              refunds, we are committed to helping resolve disputes:
            </p>
            <ul>
              <li>
                If you believe a shopkeeper is acting fraudulently or refusing a legitimate
                refund, you may contact our Grievance Officer with details of the incident.
              </li>
              <li>
                We may provide anonymized print event logs (session ID, timestamp, fee amount)
                to support your dispute resolution, where legally appropriate.
              </li>
              <li>
                In cases of repeated complaints against a specific shop, we reserve the right
                to suspend or terminate the shop&apos;s registration on the Platform.
              </li>
            </ul>
          </section>

          {/* 5. Platform Fee Refunds */}
          <section>
            <h2>5. Platform Fee Refunds</h2>
            <p>
              Printap currently charges <strong>zero platform fees</strong> to both customers
              and shopkeepers. If, in the future, platform fees are introduced and a
              legitimate refund request arises related to platform fees specifically, such
              refunds will be processed within 5–7 business days to the original payment
              method.
            </p>
          </section>

          {/* 6. How to Seek Refund */}
          <section>
            <h2>6. How to Seek a Refund</h2>
            <ol>
              <li>
                <strong>Step 1:</strong> Approach the shopkeeper directly at the counter and
                request a refund or reprint.
              </li>
              <li>
                <strong>Step 2:</strong> If the shopkeeper is unresponsive, note down the shop
                name, your token code, approximate time, and the amount paid.
              </li>
              <li>
                <strong>Step 3:</strong> Contact Printap&apos;s Grievance Officer via our{" "}
                <Link
                  href="/contact"
                  className="text-zinc-950 font-bold underline underline-offset-4"
                >
                  Contact
                </Link>{" "}
                page with the above details.
              </li>
              <li>
                <strong>Step 4:</strong> We will investigate and respond within 15 working days
                as required under the Consumer Protection Act, 2019.
              </li>
            </ol>
          </section>

          {/* 7. Consumer Protection */}
          <section>
            <h2>7. Consumer Protection</h2>
            <p>
              This policy is framed in compliance with the{" "}
              <strong>Consumer Protection (E-Commerce) Rules, 2020</strong>. Nothing in this
              policy shall prejudice or limit your rights under the Consumer Protection Act,
              2019, or any other applicable Indian law.
            </p>
            <p>
              If you are unsatisfied with the resolution of your complaint, you may approach
              the appropriate{" "}
              <strong>Consumer Disputes Redressal Forum/Commission</strong> under the Consumer
              Protection Act, 2019.
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
            <Link href="/privacy" className="hover:text-zinc-950 transition-colors">
              Privacy
            </Link>
            <Link href="/refund-policy" className="text-zinc-950 font-bold">
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

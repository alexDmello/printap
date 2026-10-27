import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact & Grievance Officer — Printap by Mellod",
  description:
    "Contact information and Grievance Officer details for Printap, as required under the IT (Intermediary Guidelines) Rules, 2021 and DPDPA 2023.",
};

export default function ContactPage() {
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
            Contact Us
          </h1>
          <p className="text-sm text-zinc-500 font-medium">
            Reach out to us for support, questions, or grievance resolution.
          </p>
        </div>

        <div className="space-y-8">
          {/* General Contact */}
          <section className="bg-zinc-50 border border-zinc-200 rounded-3xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center text-sm font-bold">
                ✉️
              </div>
              <h2 className="text-xl font-black text-zinc-950">General Enquiries</h2>
            </div>
            <p className="text-sm text-zinc-600 font-medium leading-relaxed">
              For general questions about Printap, partnerships, or media enquiries:
            </p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-zinc-400 font-bold w-16">Entity</span>
                <span className="text-zinc-900 font-bold">Mellod</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-zinc-400 font-bold w-16">Email</span>
                <a
                  href="mailto:hello@mellod.in"
                  className="text-zinc-900 font-bold underline underline-offset-4 hover:text-zinc-600 transition-colors"
                >
                  hello@mellod.in
                </a>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-zinc-400 font-bold w-16">Website</span>
                <a
                  href="https://www.mellod.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-900 font-bold underline underline-offset-4 hover:text-zinc-600 transition-colors"
                >
                  www.mellod.in
                </a>
              </div>
            </div>
          </section>

          {/* Grievance Officer — Mandatory under IT Intermediary Guidelines 2021 */}
          <section className="bg-white border-2 border-zinc-900 rounded-3xl p-6 sm:p-8 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center text-sm font-bold">
                ⚖️
              </div>
              <div>
                <h2 className="text-xl font-black text-zinc-950">Grievance Officer</h2>
                <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                  As required under IT (Intermediary Guidelines) Rules, 2021 &amp; DPDPA 2023
                </p>
              </div>
            </div>

            <p className="text-sm text-zinc-600 font-medium leading-relaxed">
              In accordance with the Information Technology (Intermediary Guidelines and
              Digital Media Ethics Code) Rules, 2021 and the Digital Personal Data
              Protection Act, 2023, the following Grievance Officer has been appointed to
              address complaints and concerns:
            </p>

            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-zinc-400 font-bold w-28">Name</span>
                <span className="text-zinc-900 font-bold">Alex D&apos;Mello</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-zinc-400 font-bold w-28">Designation</span>
                <span className="text-zinc-900 font-medium">Grievance Officer, Mellod</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-zinc-400 font-bold w-28">Email</span>
                <a
                  href="mailto:grievance@mellod.in"
                  className="text-zinc-900 font-bold underline underline-offset-4 hover:text-zinc-600 transition-colors"
                >
                  grievance@mellod.in
                </a>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-zinc-400 font-bold w-28">Address</span>
                <span className="text-zinc-900 font-medium">
                  Mumbai, Maharashtra, India
                </span>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mt-4">
              <h3 className="text-sm font-bold text-emerald-900 mb-2">
                Response Timeline
              </h3>
              <ul className="text-xs text-emerald-800 font-medium space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>
                    <strong>Acknowledgement:</strong> Within <strong>24 hours</strong> of
                    receiving your complaint.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>
                    <strong>Resolution:</strong> Within <strong>15 days</strong> from the
                    date of receipt of the complaint, as mandated by the Intermediary
                    Guidelines.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>
                    <strong>Content Takedown (if applicable):</strong> Within{" "}
                    <strong>36 hours</strong> upon receipt of a court order or government
                    notification, as required under Rule 3(1)(d) of the Intermediary Guidelines.
                  </span>
                </li>
              </ul>
            </div>
          </section>

          {/* How to File a Complaint */}
          <section className="bg-zinc-50 border border-zinc-200 rounded-3xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center text-sm font-bold">
                📝
              </div>
              <h2 className="text-xl font-black text-zinc-950">How to File a Complaint</h2>
            </div>

            <p className="text-sm text-zinc-600 font-medium leading-relaxed">
              When contacting the Grievance Officer, please include the following information
              to help us resolve your concern quickly:
            </p>

            <ol className="text-sm text-zinc-800 font-medium space-y-2 list-decimal list-inside">
              <li>
                <strong>Your Name</strong> (or an alias if you prefer to remain anonymous for
                initial enquiry).
              </li>
              <li>
                <strong>Your Email Address</strong> for correspondence.
              </li>
              <li>
                <strong>Shop Name and/or Token Code</strong> (if the complaint relates to a
                specific print transaction).
              </li>
              <li>
                <strong>Date and Approximate Time</strong> of the incident.
              </li>
              <li>
                <strong>Description of the Issue</strong> — please be as specific as possible.
              </li>
              <li>
                <strong>Supporting Evidence</strong> (screenshots, UPI transaction references,
                etc.) if available.
              </li>
            </ol>
          </section>

          {/* Escalation */}
          <section className="prose-custom">
            <h2>Escalation</h2>
            <p>
              If you are not satisfied with the resolution provided by our Grievance Officer,
              you may:
            </p>
            <ul>
              <li>
                File a complaint with the <strong>Appellate Committee</strong> constituted under
                the Intermediary Guidelines, 2021 (where applicable).
              </li>
              <li>
                Approach the appropriate{" "}
                <strong>Consumer Disputes Redressal Forum/Commission</strong> under the Consumer
                Protection Act, 2019.
              </li>
              <li>
                File a complaint with the{" "}
                <strong>Data Protection Board of India</strong> for privacy-related concerns
                under the DPDPA 2023.
              </li>
              <li>
                Approach any court of competent jurisdiction in{" "}
                <strong>Mumbai, Maharashtra, India</strong>.
              </li>
            </ul>
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
            <Link href="/refund-policy" className="hover:text-zinc-950 transition-colors">
              Refund Policy
            </Link>
            <Link href="/contact" className="text-zinc-950 font-bold">
              Contact
            </Link>
          </div>
          <div>© {new Date().getFullYear()} Mellod. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}

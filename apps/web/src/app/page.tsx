import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      {/* Hero */}
      <div className="text-center max-w-lg animate-fade-in-up">
        <div className="inline-flex items-center gap-3 mb-6">
          <img
            src="/logo.png"
            alt="Printap"
            className="w-12 h-12 rounded-2xl object-cover shadow-lg border border-black/10"
          />
          <h1 className="text-4xl font-bold gradient-text tracking-tight">
            Printap
          </h1>
        </div>

        <p className="text-lg text-[--color-foreground]/80 leading-relaxed mb-3">
          Skip the queue. Print instantly.
        </p>
        <p className="text-sm text-[--color-muted] leading-relaxed mb-10">
          Scan the QR code at any Printap-enabled shop, upload your PDF,
          pay via UPI, and the shop prints it — no waiting, no cloud storage.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-3 justify-center mb-10">
          {[
            { icon: "🔒", label: "Zero cloud storage" },
            { icon: "⚡", label: "Peer-to-peer transfer" },
            { icon: "🔥", label: "Files auto-shredded" },
            { icon: "📱", label: "Works on any phone" },
          ].map((f) => (
            <div
              key={f.label}
              className="glass rounded-full px-4 py-2 text-xs font-medium flex items-center gap-2"
            >
              <span>{f.icon}</span>
              {f.label}
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="glass rounded-2xl p-6 glow-sm text-left mb-8">
          <h2 className="text-sm font-semibold mb-4 text-center text-[--color-accent-light]">
            How it works
          </h2>
          <div className="space-y-4">
            {[
              { step: "1", title: "Scan", desc: "Scan the QR code at the shop counter" },
              { step: "2", title: "Upload", desc: "Select your PDF from your phone" },
              { step: "3", title: "Pay", desc: "Pay the shop directly via UPI" },
              { step: "4", title: "Print", desc: "Document prints instantly, file is shredded" },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[--color-accent]/10 flex items-center justify-center text-xs font-bold text-[--color-accent-light] flex-shrink-0">
                  {item.step}
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-[--color-muted]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-[--color-muted]/70">
          Are you a shop owner?{" "}
          <a
            href="https://shop.mellod.in"
            className="text-[--color-accent-light] font-medium hover:underline"
          >
            Access Shop Portal (shop.mellod.in) →
          </a>
        </p>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-center">
        <p className="text-[11px] text-[--color-muted]/40">
          © 2026 Mellod · Privacy-first printing infrastructure
        </p>
      </footer>
    </div>
  );
}

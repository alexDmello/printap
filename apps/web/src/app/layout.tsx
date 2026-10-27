import type { Metadata, Viewport } from "next";
import "./globals.css";
import CookieConsent from "@/components/CookieConsent";

export const metadata: Metadata = {
  title: "Printap — Skip the Queue, Print Instantly",
  description:
    "Scan a QR code, upload your PDF, pay via UPI, and the shop prints it — all without waiting in line. No cloud storage. Your files never leave your device.",
  keywords: ["print", "xerox", "QR", "UPI", "queue-free", "instant print"],
  authors: [{ name: "Mellod" }],
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#050510",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-mesh">
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}


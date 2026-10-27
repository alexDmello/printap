"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

const COOKIE_CONSENT_KEY = "printap_cookie_consent";

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show if user hasn't already consented
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Small delay for smoother page load
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 sm:p-6 animate-fade-in-up pointer-events-none">
      <div className="max-w-xl mx-auto bg-white border border-zinc-200/90 rounded-2xl shadow-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 pointer-events-auto">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-zinc-700 font-medium leading-relaxed">
            We use essential cookies for authentication and session management only.
            No tracking or advertising cookies.{" "}
            <Link
              href="/terms#cookies"
              className="text-zinc-950 font-bold underline underline-offset-2 hover:text-zinc-600 transition-colors"
            >
              Learn more
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={handleAccept}
          className="flex-shrink-0 px-5 py-2 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer whitespace-nowrap"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

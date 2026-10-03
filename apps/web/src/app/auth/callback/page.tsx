"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-client";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const desktopSession = searchParams.get("desktop_session") || searchParams.get("session");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;

    // Check if Google OAuth returned an error in query or URL hash
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      const searchError = searchParams.get("error") || searchParams.get("error_description");
      if (searchError || hash.includes("error=")) {
        const desc =
          searchParams.get("error_description") ||
          searchParams.get("error") ||
          "Google Sign-In failed or was cancelled.";
        setErrorMsg(desc);
        return;
      }
    }

    const supabase = getBrowserSupabase();
    let isMounted = true;

    // Process authenticated session and navigate accordingly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleSession = async (user: any) => {
      if (!user || !user.email) return;
      if (!isMounted || handledRef.current) return;
      handledRef.current = true;

      if (desktopSession) {
        router.replace(`/auth/desktop-login?session=${encodeURIComponent(desktopSession)}`);
        return;
      }

      const normalizedEmail = user.email.toLowerCase().trim();
      try {
        const { data: existingShop, error: shopErr } = await supabase
          .from("shops")
          .select("slug")
          .ilike("owner_email", normalizedEmail)
          .limit(1)
          .maybeSingle();

        if (!isMounted) return;

        if (shopErr) {
          console.warn("[Callback] Shop lookup warning:", shopErr.message);
        }

        if (existingShop?.slug) {
          // Already onboarded → go directly to download page
          router.replace(`/download?shop=${encodeURIComponent(existingShop.slug)}`);
        } else {
          // New user → go directly to onboard page to enter details
          router.replace("/onboard");
        }
      } catch (err) {
        console.warn("[Callback] Shop query exception:", err);
        if (isMounted) router.replace("/onboard");
      }
    };

    // 1. Check existing session first
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.warn("[Callback] getSession error:", error.message);
        if (isMounted) setErrorMsg(error.message);
        return;
      }
      if (session?.user) {
        handleSession(session.user);
      }
    });

    // 2. Listen for auth state change (parses URL hash or PKCE exchange in browser)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await handleSession(session.user);
      }
    });

    // Fallback: If nothing triggered after 8 seconds, send to /onboard
    const fallbackTimer = setTimeout(() => {
      if (isMounted && !handledRef.current) {
        handledRef.current = true;
        router.replace("/onboard");
      }
    }, 8000);

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, [router, desktopSession, searchParams]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4 animate-fade-in-up max-w-sm w-full text-center">
        <img src="/P.png" alt="Printap" className="w-12 h-12 rounded-2xl shadow-xs" />
        <div className="space-y-2">
          {errorMsg ? (
            <>
              <div className="text-xs font-black tracking-widest uppercase text-red-600">
                Sign-In Notice
              </div>
              <div className="text-xs text-zinc-600 font-medium">{errorMsg}</div>
              <div className="pt-2">
                <Link
                  href="/onboard"
                  className="inline-block px-4 py-2 bg-zinc-900 text-white text-xs font-bold rounded-xl hover:bg-zinc-800 transition-colors"
                >
                  Return to Onboard
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="w-8 h-8 mx-auto">
                <svg className="w-full h-full animate-spin text-zinc-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
              <div className="text-xs font-black tracking-widest uppercase text-zinc-900">
                Verifying Google Account
              </div>
              <div className="text-xs text-zinc-400 font-medium">
                Connecting to your print shop account...
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}

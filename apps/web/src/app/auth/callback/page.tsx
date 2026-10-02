"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-client";

function CallbackHandler() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let isMounted = true;

    // Process authenticated session and navigate accordingly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleSession = async (user: any) => {
      if (!user || !user.email) return;

      const normalizedEmail = user.email.toLowerCase().trim();
      try {
        const { data: existingShop } = await supabase
          .from("shops")
          .select("slug")
          .eq("owner_email", normalizedEmail)
          .maybeSingle();

        if (!isMounted) return;

        if (existingShop?.slug) {
          router.replace(`/download?shop=${encodeURIComponent(existingShop.slug)}`);
        } else {
          router.replace("/onboard");
        }
      } catch (err) {
        console.warn("[Callback] Shop query exception:", err);
        if (isMounted) router.replace("/onboard");
      }
    };

    // 1. Check existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.warn("[Callback] getSession error:", error.message);
        setErrorMsg(error.message);
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

    // Fallback: If nothing triggered after 4 seconds, send to /onboard
    const fallbackTimer = setTimeout(() => {
      if (isMounted) {
        router.replace("/onboard");
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center p-4">
      <div className="glass-strong rounded-3xl p-8 border border-zinc-200/90 shadow-xl max-w-sm w-full text-center space-y-4 animate-fadeIn">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600">
          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
        <h2 className="text-base font-extrabold text-zinc-900">
          {errorMsg ? "Authentication Notice" : "Verifying Google Account..."}
        </h2>
        <p className="text-xs text-zinc-500 leading-relaxed">
          {errorMsg
            ? errorMsg
            : "Establishing secure session and connecting your print terminal..."}
        </p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-mesh flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}

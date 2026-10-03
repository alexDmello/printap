"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-client";
import type { ShopInfo } from "@printap/shared";

type AuthState =
  | "checking"
  | "prompt"
  | "authorizing"
  | "success"
  | "no_shop"
  | "error";

function DesktopLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") || "";

  const [state, setState] = useState<AuthState>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Complete the desktop handoff: Realtime Broadcast + API Cache + Deep Link
  const completeHandoff = async (shopData: ShopInfo, sid: string) => {
    try {
      const supabase = getBrowserSupabase();

      // 1. Broadcast via Supabase Realtime channel
      const channel = supabase.channel(`desktop-auth:${sid}`, {
        config: { broadcast: { self: false } },
      });

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({
            type: "broadcast",
            event: "login-success",
            payload: { shopId: shopData.id, shop: shopData },
          });
        }
      });

      // 2. Cache in Next.js desktop-session API endpoint for polling fallback
      await fetch("/api/auth/desktop-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sid,
          shopId: shopData.id,
          shop: shopData,
        }),
      }).catch((e) => console.warn("[desktop-login] Cache POST error:", e));

      // 3. Trigger deep link back to desktop app
      const deepLinkUrl = `printap://auth-callback?session=${encodeURIComponent(sid)}&shopId=${encodeURIComponent(shopData.id)}`;
      try {
        window.location.href = deepLinkUrl;
      } catch {}
    } catch (err) {
      console.warn("[desktop-login] Handoff error:", err);
    }
  };

  // Check current auth status on mount
  useEffect(() => {
    if (!sessionId) {
      setState("error");
      setErrorMessage("Missing session identifier. Please launch login from the Printap desktop app.");
      return;
    }

    const supabase = getBrowserSupabase();
    let isMounted = true;

    const verifyShopForUser = async (email: string) => {
      setUserEmail(email);
      try {
        const { data: foundShop, error: shopError } = await supabase
          .from("shops")
          .select("*")
          .ilike("owner_email", email.toLowerCase().trim())
          .limit(1)
          .maybeSingle();

        if (!isMounted) return;

        if (shopError) {
          console.error("[desktop-login] Shop lookup error:", shopError);
          setState("error");
          setErrorMessage("Failed to look up shop account. Please try again.");
          return;
        }

        if (!foundShop) {
          setState("no_shop");
          // Notify desktop of unregistered user
          const ch = supabase.channel(`desktop-auth:${sessionId}`);
          ch.subscribe((st) => {
            if (st === "SUBSCRIBED") {
              ch.send({
                type: "broadcast",
                event: "login-error",
                payload: {
                  error: `No registered shop found for ${email}. Please complete registration in your browser.`,
                  unregistered: true,
                },
              });
            }
          });

          // Post unregistered state to API for desktop polling
          await fetch("/api/auth/desktop-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              status: "unregistered",
              error: `No registered shop found for ${email}.`,
            }),
          }).catch((e) => console.warn("[desktop-login] Cache POST error:", e));

          // Immediately redirect browser to onboarding page!
          setTimeout(() => {
            if (isMounted) {
              router.replace("/onboard");
            }
          }, 350);
          return;
        }

        if (foundShop.status === "suspended") {
          setState("error");
          setErrorMessage("This shop account has been suspended. Please contact support.");
          return;
        }

        // Shop found and active!
        const shopObj = foundShop as ShopInfo;
        setShop(shopObj);
        setState("success");
        await completeHandoff(shopObj, sessionId);
      } catch (err) {
        console.error("[desktop-login] Verification exception:", err);
        if (isMounted) {
          setState("error");
          setErrorMessage("An unexpected error occurred during verification.");
        }
      }
    };

    // 1. Check existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.warn("[desktop-login] getSession error:", error.message);
        if (isMounted) setState("prompt");
        return;
      }

      if (session?.user?.email) {
        verifyShopForUser(session.user.email);
      } else {
        if (isMounted) setState("prompt");
      }
    });

    // 2. Listen for auth state change (e.g. returning from Google OAuth redirect)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user?.email && isMounted) {
        verifyShopForUser(session.user.email);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [sessionId]);

  // Initiate Google OAuth 2.0
  const handleGoogleSignIn = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const supabase = getBrowserSupabase();
      const redirectUri = `${window.location.origin}/auth/desktop-login?session=${encodeURIComponent(sessionId)}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUri,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (error) {
        setErrorMessage(error.message || "Could not initialize Google Sign-In.");
        setIsProcessing(false);
      }
    } catch (err) {
      console.error("[desktop-login] OAuth error:", err);
      setErrorMessage("Network error connecting to Google.");
      setIsProcessing(false);
    }
  };

  // Sign out and try with another account
  const handleSwitchAccount = async () => {
    setIsProcessing(true);
    const supabase = getBrowserSupabase();
    await supabase.auth.signOut();
    setState("prompt");
    setUserEmail(null);
    setErrorMessage(null);
    setIsProcessing(false);
  };

  // Instant Dev / Demo Login for local testing
  const handleDevPreviewLogin = async () => {
    setIsProcessing(true);
    const devShop: ShopInfo = {
      id: "dev-preview-shop-id",
      name: "Alex Print Shop",
      slug: "alex-print",
      owner_name: "Alex Store Owner",
      owner_email: "alex.printshop@gmail.com",
      status: "active",
      upi_vpa: "alex@upi",
      is_online: true,
      price_bw: 2,
      price_color: 10,
      created_at: new Date().toISOString(),
    };
    setShop(devShop);
    setState("success");
    await completeHandoff(devShop, sessionId);
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-indigo-500 selection:text-white relative overflow-hidden font-sans">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/15 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Printap Counter Terminal
          </h1>
          <p className="text-xs text-slate-400">
            Hardware & Queue Agent Authorization
          </p>
        </div>

        {/* State: Checking / Loading */}
        {state === "checking" && (
          <div className="py-8 space-y-4">
            <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-400">Verifying session...</p>
          </div>
        )}

        {/* State: Prompt (Sign in with Google button) */}
        {state === "prompt" && (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-slate-300 leading-relaxed">
              Sign in with your registered Google account to connect your shop terminal.
            </p>

            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                {errorMessage}
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isProcessing}
              className="w-full py-3.5 px-6 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-900 font-semibold rounded-2xl shadow-md transition-all flex items-center justify-center gap-3 text-sm cursor-pointer disabled:opacity-50 hover:scale-[1.01]"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isProcessing ? "Connecting to Google..." : "Continue with Google"}</span>
            </button>

            {/* Dev Demo Mode */}
            {process.env.NODE_ENV !== "production" && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDevPreviewLogin}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  <span>⚡ Dev Preview Mode (Instant Connect)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* State: No Shop Found for this email */}
        {state === "no_shop" && (
          <div className="space-y-4 py-2">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Redirecting to Registration...</h2>
              <p className="text-xs text-slate-400 mt-1">
                No shop is registered for <span className="text-indigo-400 font-medium">{userEmail}</span>. Opening onboarding page in your browser...
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <a
                href="/onboard"
                className="w-full block py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs transition-colors"
              >
                Go to Onboard Now →
              </a>
              <button
                type="button"
                onClick={handleSwitchAccount}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs transition-colors cursor-pointer"
              >
                Sign in with a different Google account
              </button>
            </div>
          </div>
        )}

        {/* State: Success */}
        {state === "success" && shop && (
          <div className="space-y-4 py-2">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10 animate-bounce">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">Terminal Connected!</h2>
              <p className="text-xs text-emerald-400 font-medium mt-0.5">
                Authenticated as {shop.name}
              </p>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Your Printap Counter Terminal desktop app has received the credentials. You can now close this tab and return to the application.
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => {
                  window.location.href = `printap://auth-callback?session=${encodeURIComponent(sessionId)}&shopId=${encodeURIComponent(shop.id)}`;
                }}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs transition-all shadow-md cursor-pointer"
              >
                Open Printap Desktop App
              </button>
            </div>
          </div>
        )}

        {/* State: Error */}
        {state === "error" && (
          <div className="space-y-4 py-2">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Authorization Error</h2>
              <p className="text-xs text-red-400/90 mt-1">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setState("prompt");
                setErrorMessage(null);
              }}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>End-to-End Encrypted • Direct Hardware Agent</span>
        </div>
      </div>
    </div>
  );
}

export default function DesktopLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <DesktopLoginContent />
    </Suspense>
  );
}

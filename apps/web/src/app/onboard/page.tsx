"use client";

import React, { useState, useEffect, useCallback, useId, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { sanitizeSubdomain } from "@printap/shared";
import { getBrowserSupabase } from "@/lib/supabase-client";

// Dynamically import MapLocationPicker with SSR disabled (Leaflet requires browser window)
const MapLocationPicker = dynamic(
  () =>
    import("@/components/onboard/MapLocationPicker").then(
      (mod) => mod.MapLocationPicker
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[320px] rounded-2xl bg-zinc-100/80 flex flex-col items-center justify-center text-xs text-zinc-500 font-medium animate-pulse border border-zinc-200 gap-2">
        <svg className="w-6 h-6 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span>Loading Interactive Location Map...</span>
      </div>
    ),
  }
);

interface AutoSlugState {
  checking: boolean;
  slug: string;
  url: string;
  wasAdjusted: boolean;
}

interface GoogleAuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

function OnboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Authentication State
  const [googleUser, setGoogleUser] = useState<GoogleAuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Stepper State: 1 = Store & Password, 2 = Location, 3 = UPI Payout
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [highestStep, setHighestStep] = useState<number>(1);

  // Step 1: Store Profile & Terminal Credentials
  const [shopName, setShopName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugState, setSlugState] = useState<AutoSlugState>({
    checking: false,
    slug: "",
    url: "",
    wasAdjusted: false,
  });

  const [ownerPhone, setOwnerPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: Store Geolocation & Address
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  // Step 3: UPI Payout
  const [upiVpa, setUpiVpa] = useState("");
  const [upiBlurred, setUpiBlurred] = useState(false);

  // Global Flow & Notification state
  const [stepError, setStepError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Accessibility IDs
  const shopNameId = useId();
  const ownerPhoneId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const addressId = useId();
  const cityId = useId();
  const stateId = useId();
  const pincodeId = useId();
  const upiId = useId();

  // UPI format check (e.g. name@bank)
  const isUpiValid = Boolean(
    upiVpa.trim().includes("@") &&
      !upiVpa.trim().startsWith("@") &&
      !upiVpa.trim().endsWith("@") &&
      !/\s/.test(upiVpa.trim())
  );

  // 1. Initialize Supabase Auth & Listen for Google Sign-In
  useEffect(() => {
    const supabase = getBrowserSupabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processUser = async (user: any) => {
      if (!user || !user.email) return;

      const profile: GoogleAuthUser = {
        id: user.id,
        email: user.email.toLowerCase().trim(),
        name:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email.split("@")[0],
        avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture,
      };

      setGoogleUser(profile);

      // Check if user already has an onboarded shop
      const { data: existingShop } = await supabase
        .from("shops")
        .select("slug")
        .eq("owner_email", profile.email)
        .maybeSingle();

      if (existingShop?.slug) {
        router.push(`/download?shop=${encodeURIComponent(existingShop.slug)}`);
      }
    };

    // Check active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        processUser(session.user);
      }
      setIsAuthLoading(false);
    });

    // Listen for auth state change (e.g. after Google OAuth redirect)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await processUser(session.user);
      }
      setIsAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // Google OAuth 2.0 Sign In
  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setStepError(null);
    try {
      const supabase = getBrowserSupabase();
      const redirectUri = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUri,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        setStepError(error.message || "Failed to initiate Google Sign-In.");
        setIsSigningIn(false);
      }
    } catch (err) {
      setStepError("Network error while connecting to Google.");
      console.error(err);
      setIsSigningIn(false);
    }
  };

  // Dev Preview Login (allows testing immediately on localhost without live Google Cloud credentials)
  const handleDevPreviewLogin = () => {
    setGoogleUser({
      id: "dev-preview-user",
      email: "shopowner.preview@gmail.com",
      name: "Alex Store Owner",
      avatarUrl: "https://lh3.googleusercontent.com/a/default-user=s96-c",
    });
  };

  // Sign out / switch Google account
  const handleSignOut = async () => {
    const supabase = getBrowserSupabase();
    await supabase.auth.signOut();
    setGoogleUser(null);
    setCurrentStep(1);
    setHighestStep(1);
  };

  // Auto-assign unique subdomain based on store name (completely automated, NO user customisation)
  useEffect(() => {
    const cleanName = shopName.trim();
    if (!cleanName || cleanName.length < 2) {
      setSlug("");
      setSlugState({ checking: false, slug: "", url: "", wasAdjusted: false });
      return;
    }

    setSlugState((prev) => ({ ...prev, checking: true }));
    const timer = setTimeout(async () => {
      try {
        const rawSlug = sanitizeSubdomain(cleanName);
        const res = await fetch(
          `/api/auth/check-slug?autoAssign=true&name=${encodeURIComponent(rawSlug)}`
        );
        const data = await res.json();
        if (data.available && data.sanitizedSlug) {
          setSlug(data.sanitizedSlug);
          setSlugState({
            checking: false,
            slug: data.sanitizedSlug,
            url: data.url || `https://${data.sanitizedSlug}.mellod.in`,
            wasAdjusted: !!data.wasAdjusted,
          });
        } else {
          setSlug(rawSlug);
          setSlugState({
            checking: false,
            slug: rawSlug,
            url: `https://${rawSlug}.mellod.in`,
            wasAdjusted: false,
          });
        }
      } catch {
        const fallback = sanitizeSubdomain(cleanName);
        setSlug(fallback);
        setSlugState({
          checking: false,
          slug: fallback,
          url: `https://${fallback}.mellod.in`,
          wasAdjusted: false,
        });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [shopName]);

  // Map coordinate change handler
  const handleLocationChange = useCallback(
    (coords: {
      lat: number;
      lng: number;
      address?: string;
      city?: string;
      state?: string;
      pincode?: string;
    }) => {
      setLatitude(coords.lat);
      setLongitude(coords.lng);
      if (coords.address && !address) setAddress(coords.address);
      if (coords.city && !city) setCity(coords.city);
      if (coords.state && !state) setState(coords.state);
      if (coords.pincode && !pincode) setPincode(coords.pincode);
    },
    [address, city, state, pincode]
  );

  // Validate Step 1 (Store details & counter password)
  const handleProceedToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setStepError(null);

    if (!shopName.trim()) {
      setStepError("Please enter your business or print shop name.");
      return;
    }
    if (!slug.trim()) {
      setStepError("Please wait a moment while your unique subdomain is assigned.");
      return;
    }
    if (password.length < 8) {
      setStepError("Terminal password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setStepError("Terminal password must contain at least one uppercase letter and one number.");
      return;
    }
    if (password !== confirmPassword) {
      setStepError("Passwords do not match. Please verify your confirm password.");
      return;
    }

    setHighestStep((prev) => Math.max(prev, 2));
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Validate Step 2 (Store location)
  const handleProceedToStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    setStepError(null);

    if (latitude === null || longitude === null) {
      setStepError("Please pinpoint your store location on the map or click 'Detect My Location'.");
      return;
    }

    setHighestStep((prev) => Math.max(prev, 3));
    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Finalize Registration with Google Identity (No OTP needed) and Redirect to Download
  const handleFinalizeShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setStepError(null);

    if (!isUpiValid) {
      setStepError("Please enter a valid UPI VPA ID (e.g. apexprints@okaxis) to receive customer payments.");
      return;
    }

    if (!googleUser?.email) {
      setStepError("Google authentication session expired. Please sign in again.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/register-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: shopName.trim(),
          slug: slug.trim(),
          ownerName: googleUser.name,
          ownerEmail: googleUser.email,
          ownerPhone: ownerPhone.trim() || undefined,
          password,
          upiVpa: upiVpa.trim(),
          latitude,
          longitude,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          pincode: pincode.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.existingSlug) {
          // Already registered: redirect directly to download page
          router.push(`/download?shop=${encodeURIComponent(data.existingSlug)}`);
          return;
        }
        setStepError(data.error || "Failed to create shop profile.");
        setIsSubmitting(false);
        return;
      }

      // Successful registration: Redirect straight to desktop app download page!
      const assignedSlug = data.shop?.slug || slug.trim();
      router.push(`/download?shop=${encodeURIComponent(assignedSlug)}`);
    } catch (err) {
      setStepError("Network connection error during shop creation.");
      console.error(err);
      setIsSubmitting(false);
    }
  };

  // RENDER: LOADING STATE
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-zinc-500 font-medium">Checking authorization...</span>
        </div>
      </div>
    );
  }

  // RENDER: STEP 0 - GOOGLE OAUTH 2.0 SIGN IN SCREEN
  if (!googleUser) {
    return (
      <div className="min-h-screen bg-mesh py-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-md w-full glass-strong rounded-3xl p-8 sm:p-10 border border-zinc-200/90 shadow-2xl space-y-8 text-center animate-fadeIn">
          {/* Brand Logo */}
          <div className="space-y-3">
            <Link href="/" className="inline-flex items-center gap-2 group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center text-white font-extrabold text-2xl shadow-md">
                P
              </div>
              <span className="text-2xl font-black tracking-tight text-zinc-900 group-hover:text-indigo-600 transition-colors">
                Printap
              </span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
              Register Your Print Shop
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 max-w-sm mx-auto leading-relaxed">
              Sign in with your Google account to get your auto-assigned store link, direct UPI payouts, and download the counter terminal.
            </p>
          </div>

          {stepError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold text-center animate-shake">
              {stepError}
            </div>
          )}

          {/* Google OAuth 2.0 Sign In Button */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="w-full py-4 px-6 bg-white hover:bg-zinc-50 text-zinc-800 font-bold border-2 border-zinc-200 hover:border-zinc-300 rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-3 text-sm sm:text-base cursor-pointer disabled:opacity-50"
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
              <span>{isSigningIn ? "Connecting with Google..." : "Continue with Google"}</span>
            </button>

            {/* Dev Mode Fallback Button (Allows instant preview without waiting for OAuth API keys) */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleDevPreviewLogin}
                className="text-[11px] text-zinc-400 hover:text-zinc-600 underline font-medium transition-colors"
              >
                Or Continue in Dev / Preview Mode
              </button>
            </div>
          </div>

          {/* Trust Pillars */}
          <div className="pt-4 border-t border-zinc-100 grid grid-cols-3 gap-2 text-center text-[10px] text-zinc-500">
            <div>
              <div className="font-bold text-zinc-800">⚡ 1-Click Setup</div>
              <div>No OTPs needed</div>
            </div>
            <div>
              <div className="font-bold text-zinc-800">🔒 Verified Identity</div>
              <div>Secure Google OAuth</div>
            </div>
            <div>
              <div className="font-bold text-zinc-800">₹ Direct Payouts</div>
              <div>100% to your UPI</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // RENDER: STEPPED FLOW (AFTER GOOGLE OAUTH 2.0 LOGIN)
  return (
    <div className="min-h-screen bg-mesh py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-1 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center text-white font-extrabold text-xl shadow-md">
              P
            </div>
            <span className="text-2xl font-black tracking-tight text-zinc-900 group-hover:text-indigo-600 transition-colors">
              Printap
            </span>
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight">
            Configure Your Print Shop
          </h1>
          <p className="text-sm text-zinc-600 max-w-lg mx-auto">
            Your Google account is verified. Enter your shop details to get your auto-assigned URL and download the counter terminal.
          </p>
        </div>

        {/* Verified Google Account Pill */}
        <div className="glass rounded-2xl p-3 sm:p-4 border border-zinc-200/90 shadow-sm max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {googleUser.avatarUrl ? (
              <img
                src={googleUser.avatarUrl}
                alt={googleUser.name}
                className="w-9 h-9 rounded-full border border-zinc-200 shadow-sm"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                {googleUser.name[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-xs font-bold text-zinc-900 flex items-center gap-2">
                <span>{googleUser.name}</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  ✓ Google Verified
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 font-mono">{googleUser.email}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs text-zinc-400 hover:text-zinc-600 font-medium px-2 py-1 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            Switch Account
          </button>
        </div>

        {/* STEP PROGRESS TRACKER */}
        <div className="glass rounded-2xl p-4 border border-zinc-200/90 shadow-sm max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: "Store Setup" },
              { num: 2, label: "Location" },
              { num: 3, label: "UPI Payout" },
            ].map((step, idx) => {
              const isCurrent = currentStep === step.num;
              const isDone = currentStep > step.num;
              const canClick = step.num <= highestStep;

              return (
                <React.Fragment key={step.num}>
                  <button
                    type="button"
                    disabled={!canClick}
                    onClick={() => {
                      if (canClick) {
                        setStepError(null);
                        setCurrentStep(step.num as 1 | 2 | 3);
                      }
                    }}
                    className={`flex items-center gap-2 transition-all ${
                      canClick ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isCurrent
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105"
                          : isDone
                          ? "bg-emerald-500 text-white"
                          : "bg-zinc-100 text-zinc-400"
                      }`}
                    >
                      {isDone ? "✓" : step.num}
                    </div>
                    <span
                      className={`text-xs font-semibold hidden sm:inline ${
                        isCurrent
                          ? "text-zinc-900 font-bold"
                          : isDone
                          ? "text-emerald-700"
                          : "text-zinc-400"
                      }`}
                    >
                      {step.label}
                    </span>
                  </button>
                  {idx < 2 && (
                    <div
                      className={`flex-1 h-0.5 mx-3 sm:mx-4 transition-all ${
                        currentStep > idx + 1 ? "bg-emerald-500" : "bg-zinc-200"
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Global Error Banner */}
        {stepError && (
          <div className="max-w-3xl mx-auto p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex items-center gap-3 shadow-sm animate-shake">
            <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="flex-1">{stepError}</span>
            <button
              type="button"
              onClick={() => setStepError(null)}
              className="text-red-400 hover:text-red-600 font-bold text-sm"
            >
              ×
            </button>
          </div>
        )}

        {/* MAIN CONTAINER: 2-COLUMN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-5xl mx-auto">
          {/* LEFT COLUMN: ACTIVE STEP FORM */}
          <div className="lg:col-span-7 space-y-6">
            {/* Completed Steps Summary Accordion */}
            {currentStep > 1 && (
              <div className="space-y-3">
                <div className="glass rounded-2xl p-4 border border-emerald-200/80 bg-emerald-50/30 flex items-center justify-between text-xs transition-all">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                      ✓
                    </span>
                    <div>
                      <div className="font-bold text-zinc-900 flex items-center gap-2">
                        <span>{shopName}</span>
                        <span className="text-emerald-700 font-mono text-[11px] bg-emerald-100/70 px-2 py-0.5 rounded-full">
                          {slug}.mellod.in
                        </span>
                      </div>
                      <div className="text-zinc-500 text-[11px]">
                        Terminal password configured
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStepError(null);
                      setCurrentStep(1);
                    }}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    Edit
                  </button>
                </div>

                {currentStep > 2 && (
                  <div className="glass rounded-2xl p-4 border border-emerald-200/80 bg-emerald-50/30 flex items-center justify-between text-xs transition-all">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                        ✓
                      </span>
                      <div>
                        <div className="font-bold text-zinc-900">
                          {city ? `${city}${state ? `, ${state}` : ""}` : "Store Location Pinpointed"}
                        </div>
                        <div className="text-zinc-500 text-[11px] truncate max-w-xs">
                          {address || (latitude && longitude ? `Coords: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}` : "")}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStepError(null);
                        setCurrentStep(2);
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 1: STORE DETAILS & TERMINAL PASSWORD */}
            {currentStep === 1 && (
              <form onSubmit={handleProceedToStep2} className="glass-strong rounded-3xl p-6 sm:p-8 border border-zinc-200 shadow-sm space-y-6 animate-fadeIn">
                <div className="border-b border-zinc-100 pb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                      Step 1 of 3 • Store Profile
                    </span>
                    <span className="text-[11px] text-emerald-600 font-semibold">● Google Linked</span>
                  </div>
                  <h2 className="text-xl font-extrabold text-zinc-900 mt-1">Shop Details & Terminal Access</h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Enter your shop name. Your unique customer subdomain is automatically assigned.
                  </p>
                </div>

                <div className="space-y-5">
                  {/* Shop Name */}
                  <div className="space-y-1.5">
                    <label htmlFor={shopNameId} className="block text-xs font-bold text-zinc-700">
                      Shop / Business Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id={shopNameId}
                      type="text"
                      required
                      placeholder="e.g. Apex Digital Print & Xerox"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-900 font-medium placeholder:text-zinc-400 shadow-sm"
                    />
                  </div>

                  {/* Auto-Assigned Subdomain Live Card (NON-CUSTOMISABLE AS REQUESTED) */}
                  <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/50 border border-indigo-100/90 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                        Auto-Assigned Subdomain Handle
                      </span>
                      {slugState.checking ? (
                        <span className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1">
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Checking uniqueness...
                        </span>
                      ) : slug ? (
                        <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <span>✓ Guaranteed Unique</span>
                          {slugState.wasAdjusted && <span className="text-zinc-500">(auto-numbered)</span>}
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-400">Type shop name above</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-indigo-200/80 shadow-sm">
                      <span className="text-xs text-zinc-400 select-none">🌐</span>
                      <div className="font-mono text-xs sm:text-sm text-indigo-700 font-bold truncate flex-1">
                        {slug ? `https://${slug}.mellod.in` : "https://your-shop.mellod.in"}
                      </div>
                      <span className="text-[10px] text-zinc-400 font-medium select-none bg-zinc-100 px-2 py-0.5 rounded-md">
                        Auto-assigned
                      </span>
                    </div>

                    <p className="text-[11px] text-indigo-900/70 leading-relaxed">
                      Derived automatically from your shop name with collision protection. Customers use this link to upload prints.
                    </p>
                  </div>

                  {/* Owner Phone */}
                  <div className="space-y-1.5">
                    <label htmlFor={ownerPhoneId} className="block text-xs font-bold text-zinc-700">
                      Counter Phone Number
                    </label>
                    <input
                      id={ownerPhoneId}
                      type="tel"
                      placeholder="e.g. +91 98765 43210"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-900 font-medium placeholder:text-zinc-400"
                    />
                  </div>

                  {/* Terminal Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor={passwordId} className="block text-xs font-bold text-zinc-700">
                          Counter Terminal Password <span className="text-red-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                      <input
                        id={passwordId}
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="Min. 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-900 font-medium placeholder:text-zinc-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor={confirmPasswordId} className="block text-xs font-bold text-zinc-700">
                        Confirm Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        id={confirmPasswordId}
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-900 font-medium placeholder:text-zinc-400"
                      />
                    </div>
                  </div>

                  {/* Password Criteria Badges */}
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span
                      className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                        password.length >= 8 ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      8+ characters
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                        /[A-Z]/.test(password) ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      Uppercase letter
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                        /[0-9]/.test(password) ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      Number
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                        password && password === confirmPassword
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      Passwords match
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    You will use your Google email (<code>{googleUser.email}</code>) and this password to sign into the downloaded desktop counter agent.
                  </p>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Continue to Store Location</span>
                    <span>→</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: STORE GEOLOCATION & ADDRESS */}
            {currentStep === 2 && (
              <form onSubmit={handleProceedToStep3} className="glass-strong rounded-3xl p-6 sm:p-8 border border-zinc-200 shadow-sm space-y-6 animate-fadeIn">
                <div className="border-b border-zinc-100 pb-4">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                    Step 2 of 3 • Location
                  </span>
                  <h2 className="text-xl font-extrabold text-zinc-900 mt-1">Store Geolocation & Address</h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Pinpoint your store on the map so nearby students and walk-ins can find your counter.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-zinc-700">
                    Pinpoint Shop on Map <span className="text-red-500">*</span>
                  </label>
                  <MapLocationPicker
                    latitude={latitude}
                    longitude={longitude}
                    onChange={handleLocationChange}
                  />
                </div>

                {/* Street address and town inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="sm:col-span-3 space-y-1.5">
                    <label htmlFor={addressId} className="block text-xs font-bold text-zinc-700">
                      Street Address / Building Landmark
                    </label>
                    <input
                      id={addressId}
                      type="text"
                      placeholder="e.g. Shop #4, Ground Floor, Near University North Gate"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-900 placeholder:text-zinc-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor={cityId} className="block text-xs font-bold text-zinc-700">
                      City
                    </label>
                    <input
                      id={cityId}
                      type="text"
                      placeholder="e.g. Bangalore"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-900 placeholder:text-zinc-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor={stateId} className="block text-xs font-bold text-zinc-700">
                      State
                    </label>
                    <input
                      id={stateId}
                      type="text"
                      placeholder="e.g. Karnataka"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-900 placeholder:text-zinc-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor={pincodeId} className="block text-xs font-bold text-zinc-700">
                      Pincode
                    </label>
                    <input
                      id={pincodeId}
                      type="text"
                      placeholder="e.g. 560038"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-900 placeholder:text-zinc-400"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStepError(null);
                      setCurrentStep(1);
                    }}
                    className="py-3 px-5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-sm font-semibold rounded-xl transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Continue to UPI Payout</span>
                    <span>→</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: DIRECT UPI PAYOUT & LAUNCH */}
            {currentStep === 3 && (
              <form onSubmit={handleFinalizeShop} className="glass-strong rounded-3xl p-6 sm:p-8 border border-zinc-200 shadow-sm space-y-6 animate-fadeIn">
                <div className="border-b border-zinc-100 pb-4">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                    Step 3 of 3 • UPI Payout & Launch
                  </span>
                  <h2 className="text-xl font-extrabold text-zinc-900 mt-1">Direct Customer UPI Payout</h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Enter the UPI ID where 100% of customer print payments will be credited directly to your bank account.
                  </p>
                </div>

                {/* UPI VPA ID Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor={upiId} className="block text-xs font-bold text-zinc-700">
                      Shop Owner UPI ID (VPA) <span className="text-red-500">*</span>
                    </label>
                    {upiVpa && (
                      isUpiValid ? (
                        <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                          ✓ Valid UPI format
                        </span>
                      ) : upiBlurred ? (
                        <span className="text-[11px] text-red-500 font-medium">
                          Must contain @ (e.g. name@okaxis)
                        </span>
                      ) : null
                    )}
                  </div>
                  <input
                    id={upiId}
                    type="text"
                    required
                    placeholder="e.g. apexprints@okaxis, shop@okhdfcbank"
                    value={upiVpa}
                    onChange={(e) => setUpiVpa(e.target.value)}
                    onBlur={() => setUpiBlurred(true)}
                    className={`w-full px-4 py-3 text-base font-mono bg-white border rounded-xl focus:ring-2 text-zinc-900 placeholder:text-zinc-400 transition-colors ${
                      upiVpa && upiBlurred
                        ? isUpiValid
                          ? "border-emerald-400 focus:ring-emerald-500"
                          : "border-red-400 focus:ring-red-500"
                        : "border-zinc-300 focus:ring-indigo-500"
                    }`}
                  />
                  <p className="text-[11px] text-zinc-500">
                    Works with Google Pay, PhonePe, Paytm, BHIM, Axis, ICICI, etc.
                  </p>
                </div>

                {/* P2P Direct Settlement Explainer */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 rounded-2xl p-4 flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-black text-base shadow-sm">
                    ₹
                  </div>
                  <div className="text-xs text-emerald-950 space-y-1">
                    <div className="font-bold text-sm">Direct Peer-to-Peer Settlements</div>
                    <p className="leading-relaxed text-emerald-800">
                      When a customer pays via UPI QR code, the funds are deposited directly into your bank.
                      <strong> Printap takes zero commission and holds zero funds.</strong>
                    </p>
                  </div>
                </div>

                {/* Summary Card */}
                <div className="bg-zinc-50/80 border border-zinc-200 rounded-2xl p-4 text-xs space-y-3">
                  <div className="font-bold text-zinc-700 uppercase tracking-wider text-[11px] flex items-center justify-between">
                    <span>Onboarding Summary</span>
                    <span className="text-emerald-700 font-semibold">Ready to launch</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-zinc-600 font-medium pt-1">
                    <div>Shop: <span className="font-bold text-zinc-900 block truncate">{shopName}</span></div>
                    <div>Subdomain: <span className="font-mono font-bold text-indigo-600 block truncate">{slug}.mellod.in</span></div>
                    <div>Owner: <span className="font-bold text-zinc-900 block truncate">{googleUser.name}</span></div>
                    <div>Login Email: <span className="font-bold text-zinc-900 block truncate">{googleUser.email}</span></div>
                    <div className="col-span-2">
                      Location: <span className="text-zinc-900 block truncate">{address || `${city || ""} ${state || ""}` || "Coordinates pinned on map"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStepError(null);
                      setCurrentStep(2);
                    }}
                    className="py-3 px-5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-sm font-semibold rounded-xl transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-4 px-6 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 text-white font-extrabold text-sm sm:text-base rounded-2xl shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span>Launching Shop & Preparing Setup...</span>
                      </>
                    ) : (
                      <>
                        <span>Complete Setup & Download Desktop App 🚀</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* RIGHT COLUMN: LIVE STOREFRONT PREVIEW CARD */}
          <div className="lg:col-span-5 sticky top-8 space-y-4 hidden lg:block">
            <div className="glass-strong rounded-3xl p-6 border border-zinc-200/90 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
                  Live Storefront Preview
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active Mockup
                </span>
              </div>

              {/* Storefront Mock Browser Window */}
              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="bg-zinc-100/90 px-3 py-2 border-b border-zinc-200/80 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block"></span>
                  </div>
                  <div className="flex-1 bg-white px-2.5 py-1 rounded-md text-[10px] font-mono text-zinc-600 border border-zinc-200 truncate flex items-center gap-1">
                    <svg className="w-3 h-3 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <span className="truncate">{slug ? `${slug}.mellod.in` : "your-shop.mellod.in"}</span>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
                      {shopName ? shopName.charAt(0).toUpperCase() : "P"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-extrabold text-sm text-zinc-900 truncate">
                        {shopName || "Your Print Shop"}
                      </h4>
                      <p className="text-[11px] text-zinc-500 truncate">
                        {city ? `${city}${state ? `, ${state}` : ""}` : "Instant Peer-to-Peer Document Printing"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md border border-indigo-100">
                      ⚡ Instant Upload
                    </span>
                    <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md border border-emerald-100">
                      ₹ Direct UPI
                    </span>
                    <span className="bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded-md border border-purple-100">
                      📄 PDF / DOCX / JPG
                    </span>
                  </div>

                  <div className="border border-dashed border-zinc-300 rounded-xl p-3 text-center bg-zinc-50/50">
                    <div className="text-[11px] font-semibold text-zinc-700">Drop documents here to print</div>
                    <div className="text-[9px] text-zinc-400 mt-0.5">Automated counter print queue</div>
                  </div>
                </div>
              </div>

              {/* Counter Terminal Info Card */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-xs space-y-2">
                <div className="font-bold text-zinc-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Counter Agent Login
                </div>
                <div className="space-y-1 text-zinc-600 font-mono text-[11px]">
                  <div>User: <span className="text-zinc-900 font-semibold">{googleUser.email}</span></div>
                  <div>UPI: <span className="text-emerald-700 font-semibold">{upiVpa || "Not configured"}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-mesh flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <OnboardContent />
    </Suspense>
  );
}

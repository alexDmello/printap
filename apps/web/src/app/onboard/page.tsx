"use client";

import React, { useState, useEffect, useCallback, useId, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sanitizeSubdomain } from "@printap/shared";
import { getBrowserSupabase } from "@/lib/supabase-client";
import {
  LOGIN_SESSION_MAX_AGE_MS,
  enforceSessionTimeout,
  getLoginSessionRemainingMs,
  isLoginSessionExpired,
  clearLoginSession,
  formatRemainingTime,
} from "@/lib/session-manager";

// Dynamically import MapLocationPicker with SSR disabled (Leaflet requires browser window)
const MapLocationPicker = dynamic(
  () =>
    import("@/components/onboard/MapLocationPicker").then(
      (mod) => mod.MapLocationPicker
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[320px] rounded-3xl bg-zinc-50 flex flex-col items-center justify-center text-xs text-zinc-500 font-medium animate-pulse border border-zinc-200 gap-3 shadow-inner">
        <div className="w-10 h-10 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-800 shadow-sm">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
        <span className="font-bold text-zinc-700">Loading Map...</span>
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

  // Authentication State
  const [googleUser, setGoogleUser] = useState<GoogleAuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [sessionRemainingMs, setSessionRemainingMs] = useState<number>(LOGIN_SESSION_MAX_AGE_MS);

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
  const [copiedSlug, setCopiedSlug] = useState(false);

  const [ownerPhone, setOwnerPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  // Right-Column Mockup View Mode: 'mobile' | 'terminal'
  const [previewTab, setPreviewTab] = useState<"mobile" | "terminal">("mobile");

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

  // Password Strength Calculation (0 to 4)
  const passwordCriteria = {
    length: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    match: Boolean(password && password === confirmPassword),
  };

  const passwordStrengthScore = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password) || password.length >= 12,
  ].filter(Boolean).length;

  const strengthLabels = ["Needs more characters", "Fair", "Good", "Very Strong"];
  const strengthColors = ["bg-zinc-300", "bg-zinc-500", "bg-zinc-800", "bg-zinc-950"];

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
    let isMounted = true;
    let isProcessing = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processUser = async (user: any) => {
      if (!user || !user.email || isProcessing || !isMounted) return;
      isProcessing = true;

      try {
        const profile: GoogleAuthUser = {
          id: user.id,
          email: user.email.toLowerCase().trim(),
          name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email.split("@")[0],
          avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture,
        };

        // Enforce 10-minute maximum session retention policy
        const { valid, remainingMs } = await enforceSessionTimeout(supabase);
        if (!valid) {
          clearLoginSession();
          setGoogleUser(null);
          setCurrentStep(1);
          setHighestStep(1);
          setStepError("Your login session expired after 10 minutes. Please sign in again.");
          return;
        }
        setSessionRemainingMs(remainingMs);

        // Check if user already has an onboarded shop (case-insensitive)
        const { data: existingShop } = await supabase
          .from("shops")
          .select("slug")
          .ilike("owner_email", profile.email)
          .limit(1)
          .maybeSingle();

        if (!isMounted) return;

        if (existingShop?.slug) {
          // Already onboarded → redirect immediately to counter terminal download
          router.replace(`/download?shop=${encodeURIComponent(existingShop.slug)}`);
          return;
        }

        // New user → display the onboarding stepper
        setGoogleUser(profile);
      } catch (err) {
        console.warn("[Onboard] Failed checking shop status:", err);
      } finally {
        isProcessing = false;
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    };

    // Check active session on load
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      if (session?.user) {
        await processUser(session.user);
      } else {
        // If OAuth hash or code is present in URL, keep loading spinner active
        // so the user does NOT see the sign-in showcase flash while Supabase exchanges tokens
        const hasAuthInUrl =
          typeof window !== "undefined" &&
          (window.location.hash.includes("access_token") ||
            window.location.search.includes("code="));
        if (!hasAuthInUrl) {
          setIsAuthLoading(false);
        }
      }
    });

    // Listen for auth state change (e.g. after Google OAuth redirect)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await processUser(session.user);
      } else {
        if (isMounted && !isProcessing) {
          setIsAuthLoading(false);
        }
      }
    });

    // Fallback: Ensure loading screen dismisses even if auth hangs
    const safetyTimer = setTimeout(() => {
      if (isMounted && !isProcessing) {
        setIsAuthLoading(false);
      }
    }, 6000);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [router]);

  // 10-Minute Login Session Retention Sweeper
  useEffect(() => {
    if (!googleUser) return;

    const checkTimeout = async () => {
      const remaining = getLoginSessionRemainingMs();
      setSessionRemainingMs(remaining);
      if (remaining <= 0) {
        const supabase = getBrowserSupabase();
        await supabase.auth.signOut();
        clearLoginSession();
        setGoogleUser(null);
        setCurrentStep(1);
        setHighestStep(1);
        setStepError("Your login session timed out (10-minute limit). Please sign in again.");
      }
    };

    checkTimeout();
    const interval = setInterval(checkTimeout, 1000);
    return () => clearInterval(interval);
  }, [googleUser]);

  // Google OAuth 2.0 Sign In
  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setStepError(null);
    try {
      const supabase = getBrowserSupabase();
      const isLocal =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1" ||
          window.location.hostname.endsWith(".localhost"));

      const redirectUri = isLocal
        ? `${window.location.origin}/auth/callback`
        : "https://www.mellod.in/auth/callback";

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUri,
          queryParams: {
            access_type: "offline",
          },
        },
      });

      if (error) {
        setStepError(error.message || "Could not sign in with Google.");
        setIsSigningIn(false);
      }
    } catch (err) {
      setStepError("Network connection error. Please try again.");
      console.error(err);
      setIsSigningIn(false);
    }
  };

  // Sign out / switch Google account
  const handleSignOut = async () => {
    const supabase = getBrowserSupabase();
    await supabase.auth.signOut();
    clearLoginSession();
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

  // Copy Subdomain URL to clipboard
  const handleCopySlug = () => {
    if (!slug) return;
    const fullUrl = `https://${slug}.mellod.in`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedSlug(true);
    setTimeout(() => setCopiedSlug(false), 2000);
  };

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
      if (coords.address) setAddress(coords.address);
      if (coords.city) setCity(coords.city);
      if (coords.state) setState(coords.state);
      if (coords.pincode) setPincode(coords.pincode);
    },
    []
  );

  // Validate Step 1 (Store details & counter password)
  const handleProceedToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setStepError(null);

    if (!shopName.trim()) {
      setStepError("Please type your shop name.");
      return;
    }
    if (!slug.trim()) {
      setStepError("Please wait a moment while your shop link is generated.");
      return;
    }
    if (password.length < 8) {
      setStepError("Password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setStepError("Password must have at least one capital letter and one number.");
      return;
    }
    if (password !== confirmPassword) {
      setStepError("Passwords do not match. Please check again.");
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
      setStepError("Please select your shop on the map or click 'Detect My Location'.");
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
      setStepError("Please enter a valid UPI ID (e.g. apexprints@okaxis) to receive your payments.");
      return;
    }

    if (!googleUser?.email) {
      setStepError("Your login session timed out. Please sign in again.");
      return;
    }

    if (isLoginSessionExpired()) {
      const supabase = getBrowserSupabase();
      await supabase.auth.signOut();
      clearLoginSession();
      setGoogleUser(null);
      setCurrentStep(1);
      setHighestStep(1);
      setStepError("Your login session timed out (10-minute limit). Please sign in again.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = getBrowserSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      const res = await fetch("/api/auth/register-google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
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
          clearLoginSession();
          router.push(`/download?shop=${encodeURIComponent(data.existingSlug)}`);
          return;
        }
        setStepError(data.error || "Could not complete shop registration.");
        setIsSubmitting(false);
        return;
      }

      // Successful registration: Clear temporary onboarding session and redirect straight to desktop app download page!
      clearLoginSession();
      const assignedSlug = data.shop?.slug || slug.trim();
      router.push(`/download?shop=${encodeURIComponent(assignedSlug)}`);
    } catch (err) {
      setStepError("Network connection error. Please try again.");
      console.error(err);
      setIsSubmitting(false);
    }
  };

  // RENDER: LOADING STATE
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 animate-fade-in-up">
          <img src="/P.png" alt="Printap" className="w-12 h-12 rounded-2xl shadow-xs" />
          <div className="text-center space-y-1">
            <div className="text-xs font-black tracking-widest uppercase text-zinc-900">
              Loading Printap
            </div>
            <div className="text-xs text-zinc-400 font-medium">Please wait a moment...</div>
          </div>
        </div>
      </div>
    );
  }

  // RENDER: STEP 0 - PREMIUM MONOCHROME SIGN IN SHOWCASE (WHEN NOT LOGGED IN)
  if (!googleUser) {
    return (
      <div className="min-h-screen bg-mesh py-12 sm:py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden flex items-center justify-center selection:bg-zinc-900 selection:text-white">
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center relative z-10">
          {/* LEFT COLUMN: PLAIN WORDS VALUE PROPOSITION */}
          <div className="lg:col-span-7 space-y-8 text-left animate-fade-in-up">
            {/* Super Header Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white border border-zinc-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-zinc-900 animate-pulse"></span>
              <span className="text-[11px] font-bold text-zinc-800 tracking-wider uppercase">
                Print Shop Registration • Free Forever
              </span>
            </div>

            {/* Hero Heading */}
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-zinc-950 tracking-tight leading-[1.08]">
                Run your print counter with zero hassle.
              </h1>
              <p className="text-base sm:text-lg text-zinc-600 max-w-xl leading-relaxed font-normal">
                Give customers an easy link to upload and pay from their phones. Documents appear on your counter computer screen ready to print. All money goes 100% straight to your bank account.
              </p>
            </div>

            {/* Feature Cards Grid (Plain Words) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-2xs space-y-2 hover:border-zinc-400 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-zinc-100 text-zinc-900 flex items-center justify-center font-bold text-sm">
                  🌐
                </div>
                <div className="font-extrabold text-sm text-zinc-950">Your Own Web Link</div>
                <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                  Customers visit your shop link on their phones. No app to download.
                </p>
              </div>

              <div className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-2xs space-y-2 hover:border-zinc-400 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-zinc-100 text-zinc-900 flex items-center justify-center font-bold text-sm">
                  ⚡
                </div>
                <div className="font-extrabold text-sm text-zinc-950">1-Click Printing</div>
                <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                  Files pop up on your computer. Click print and hand the paper to the customer.
                </p>
              </div>

              <div className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-2xs space-y-2 hover:border-zinc-400 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-zinc-100 text-zinc-900 flex items-center justify-center font-bold text-sm">
                  ₹
                </div>
                <div className="font-extrabold text-sm text-zinc-950">100% Direct UPI</div>
                <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                  Customer payments go directly into your bank. Zero fees or deductions.
                </p>
              </div>
            </div>

            {/* Simple Proof Row */}
            <div className="pt-2 flex items-center gap-6 sm:gap-10 border-t border-zinc-200 text-left">
              <div>
                <div className="text-2xl sm:text-3xl font-black text-zinc-950">0%</div>
                <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                  Platform Fees
                </div>
              </div>
              <div className="h-8 w-px bg-zinc-200"></div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-zinc-950">&lt; 30s</div>
                <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                  Counter Turnaround
                </div>
              </div>
              <div className="h-8 w-px bg-zinc-200"></div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-zinc-950">100%</div>
                <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                  Direct Bank Settlement
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: CLEAN BLACK & WHITE AUTH CARD */}
          <div className="lg:col-span-5 w-full max-w-md mx-auto animate-fade-in-up">
            <div className="bg-white rounded-3xl p-8 sm:p-10 border border-zinc-200 shadow-md space-y-7 text-center relative">
              {/* Brand Logo */}
              <div className="space-y-3">
                <img
                  src="/P.png"
                  alt="Printap Logo"
                  className="w-14 h-14 rounded-2xl mx-auto shadow-sm"
                />
                <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
                  Shop Owner Sign In
                </h2>
                <p className="text-xs text-zinc-600 max-w-xs mx-auto leading-relaxed font-medium">
                  Sign in with Google to set up your shop, get your free web link, and download the counter app.
                </p>
              </div>

              {stepError && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold text-center">
                  {stepError}
                </div>
              )}

              {/* The Master Google Button */}
              <div className="space-y-4 pt-1">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="w-full py-4 px-6 bg-white hover:bg-zinc-50 active:bg-zinc-100 text-zinc-900 font-bold border-2 border-zinc-900 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-3 text-sm sm:text-base cursor-pointer disabled:opacity-50 hover:scale-[1.01]"
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
                  <span>{isSigningIn ? "Connecting to Google..." : "Continue with Google"}</span>
                </button>

                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  By continuing, you agree to Printap&apos;s{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    className="text-zinc-900 font-semibold underline underline-offset-2 hover:text-zinc-700"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="text-zinc-900 font-semibold underline underline-offset-2 hover:text-zinc-700"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>

              {/* Trust Badge Footer */}
              <div className="pt-5 border-t border-zinc-100 flex items-center justify-center gap-4 text-[11px] text-zinc-500 font-semibold">
                <span>Safe Google Sign-In</span>
                <span>•</span>
                <span>Direct Bank UPI</span>
                <span>•</span>
                <span>Free Forever</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // RENDER: STEPPED FLOW (AFTER GOOGLE LOGIN)
  return (
    <div className="min-h-screen bg-mesh py-8 sm:py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden selection:bg-zinc-900 selection:text-white">
      <div className="max-w-6xl mx-auto space-y-7 relative z-10">
        {/* Brand Bar & Authenticated Account Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-3xl p-4 sm:px-6 border border-zinc-200 shadow-2xs">
          <Link href="/" className="inline-flex flex-col group">
            <span className="text-xl font-black tracking-tight text-zinc-950">
              Printap
            </span>
            <span className="text-[10px] text-zinc-400 block font-bold -mt-0.5 tracking-wider uppercase">
              Shop Registration
            </span>
          </Link>

          {/* Verified Google Account Capsule */}
          <div className="flex items-center gap-3 bg-zinc-50 px-3.5 py-2 rounded-2xl border border-zinc-200">
            {googleUser.avatarUrl ? (
              <img
                src={googleUser.avatarUrl}
                alt={googleUser.name}
                className="w-8 h-8 rounded-full border border-zinc-200 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-900 text-white font-bold flex items-center justify-center text-xs shrink-0">
                {googleUser.name[0]?.toUpperCase()}
              </div>
            )}
            <div className="text-left min-w-0">
              <div className="text-xs font-black text-zinc-900 flex items-center gap-1.5 truncate">
                <span className="truncate">{googleUser.name}</span>
                <span className="text-[9px] bg-zinc-200 text-zinc-800 font-extrabold px-1.5 py-0.2 rounded-full shrink-0">
                  Signed In
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono truncate">
                <span className="truncate">{googleUser.email}</span>
                <span className="text-zinc-300">•</span>
                <span
                  className={`font-semibold shrink-0 ${
                    sessionRemainingMs < 2 * 60 * 1000
                      ? "text-amber-600 animate-pulse font-bold"
                      : "text-zinc-400"
                  }`}
                  title="Shop onboarding login session retains for 10 minutes"
                >
                  ⏱ {formatRemainingTime(sessionRemainingMs)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs text-zinc-400 hover:text-zinc-950 font-bold px-2 py-1 rounded-lg hover:bg-zinc-200 transition-colors shrink-0 cursor-pointer"
            >
              Switch
            </button>
          </div>
        </div>

        {/* STEP PROGRESS TRACKER CAPSULE */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-zinc-200 shadow-xs max-w-3xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: "1. Shop Details" },
              { num: 2, label: "2. Shop Location" },
              { num: 3, label: "3. Bank Payment (UPI)" },
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
                    className={`flex items-center gap-2 px-3 py-2 rounded-2xl transition-all ${
                      isCurrent
                        ? "bg-zinc-950 text-white shadow-xs font-bold"
                        : isDone
                        ? "text-zinc-900 font-bold hover:bg-zinc-100"
                        : "text-zinc-400 font-medium"
                    } ${canClick ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${
                        isCurrent
                          ? "bg-white text-zinc-950"
                          : isDone
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-400"
                      }`}
                    >
                      {isDone ? "✓" : step.num}
                    </div>
                    <div className="text-xs leading-tight hidden sm:block">
                      {step.label}
                    </div>
                  </button>
                  {idx < 2 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${
                        currentStep > idx + 1 ? "bg-zinc-900" : "bg-zinc-200"
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-500 font-semibold px-1">
            <span>Step {currentStep} of 3</span>
            <span className="text-zinc-900 font-bold">
              {currentStep === 1 ? "Step 1: Your Shop Details" : currentStep === 2 ? "Step 2: Map Location" : "Step 3: Setup Direct Payment"}
            </span>
          </div>
        </div>

        {/* Global Error Banner */}
        {stepError && (
          <div className="max-w-3xl mx-auto p-4 bg-red-50 border border-red-200 text-red-900 rounded-2xl text-xs font-bold flex items-center gap-3">
            <span className="flex-1">{stepError}</span>
            <button
              type="button"
              onClick={() => setStepError(null)}
              className="text-red-500 hover:text-red-900 font-black text-sm cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* MAIN CONTAINER: 2-COLUMN MONOCHROME LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-6xl mx-auto">
          {/* LEFT COLUMN: ACTIVE STEP FORM */}
          <div className="lg:col-span-7 space-y-5">
            {/* Completed steps summaries */}
            {currentStep > 1 && (
              <div className="space-y-2.5">
                <div className="bg-white rounded-2xl p-4 border border-zinc-200 flex items-center justify-between text-xs shadow-2xs">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      ✓
                    </span>
                    <div>
                      <div className="font-extrabold text-zinc-950 flex items-center gap-2">
                        <span>{shopName}</span>
                        <span className="text-zinc-600 font-mono text-[11px] bg-zinc-100 px-2 py-0.5 rounded-full font-bold">
                          {slug}.mellod.in
                        </span>
                      </div>
                      <div className="text-zinc-500 text-[11px] font-medium">
                        Shop link and password saved
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStepError(null);
                      setCurrentStep(1);
                    }}
                    className="text-zinc-900 underline font-bold px-2 py-1 text-xs cursor-pointer"
                  >
                    Change
                  </button>
                </div>

                {currentStep > 2 && (
                  <div className="bg-white rounded-2xl p-4 border border-zinc-200 flex items-center justify-between text-xs shadow-2xs">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        ✓
                      </span>
                      <div>
                        <div className="font-extrabold text-zinc-950">
                          {city ? `${city}${state ? `, ${state}` : ""}` : "Shop Location Saved"}
                        </div>
                        <div className="text-zinc-500 text-[11px] truncate max-w-xs font-medium">
                          {address || "Coordinates pinned on map"}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStepError(null);
                        setCurrentStep(2);
                      }}
                      className="text-zinc-900 underline font-bold px-2 py-1 text-xs cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 1: STORE DETAILS & COMPUTER PASSWORD */}
            {currentStep === 1 && (
              <form onSubmit={handleProceedToStep2} className="bg-white rounded-3xl p-6 sm:p-9 border border-zinc-200 shadow-sm space-y-7 animate-fade-in-up">
                <div className="border-b border-zinc-100 pb-4">
                  <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">
                    Step 1 of 3
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 mt-1">Shop Details & Password</h2>
                  <p className="text-xs text-zinc-600 mt-1 leading-relaxed font-medium">
                    Enter the name of your print shop. We will create your shop&apos;s free web link automatically.
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Shop Name */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor={shopNameId} className="block text-xs font-extrabold text-zinc-800 uppercase tracking-wide">
                        Shop Name <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[11px] text-zinc-400 font-medium">
                        {shopName.length} / 50
                      </span>
                    </div>
                    <input
                      id={shopNameId}
                      type="text"
                      required
                      maxLength={50}
                      placeholder="e.g. Apex Xerox & Digital Prints"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      className="w-full px-4.5 py-3.5 text-base bg-white border border-zinc-300 rounded-2xl focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 text-zinc-950 font-bold placeholder:text-zinc-400 placeholder:font-normal shadow-2xs transition-all"
                    />
                  </div>

                  {/* Auto-Assigned Subdomain Live Card */}
                  <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-5 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-zinc-900 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-zinc-950"></span>
                        Your Shop&apos;s Web Link
                      </span>
                      {slugState.checking ? (
                        <span className="text-[11px] text-zinc-500 font-bold">
                          Creating link...
                        </span>
                      ) : slug ? (
                        <span className="text-[11px] text-zinc-900 font-bold bg-zinc-200 px-2.5 py-0.5 rounded-full">
                          Ready & Unique
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-400 font-medium">Type shop name above</span>
                      )}
                    </div>

                    {/* Address Bar */}
                    <div className="flex items-center gap-2.5 bg-white px-4 py-3 rounded-2xl border border-zinc-200 shadow-2xs">
                      <span className="text-xs">🔒</span>
                      <div className="font-mono text-xs sm:text-sm text-zinc-950 font-bold truncate flex-1">
                        {slug ? `https://${slug}.mellod.in` : "https://your-shop.mellod.in"}
                      </div>
                      {slug && (
                        <button
                          type="button"
                          onClick={handleCopySlug}
                          className="text-[10px] text-zinc-900 font-bold px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 transition-colors cursor-pointer"
                        >
                          {copiedSlug ? "Copied! ✓" : "Copy"}
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-zinc-600 leading-relaxed font-medium">
                      Customers will open this web link on their smartphones to upload files and print at your counter.
                    </p>
                  </div>

                  {/* Owner Phone */}
                  <div className="space-y-2">
                    <label htmlFor={ownerPhoneId} className="block text-xs font-extrabold text-zinc-800 uppercase tracking-wide">
                      Phone Number <span className="text-zinc-400 font-normal">(Optional)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 select-none">
                        🇮🇳 +91
                      </span>
                      <input
                        id={ownerPhoneId}
                        type="tel"
                        placeholder="98765 43210"
                        value={ownerPhone}
                        onChange={(e) => setOwnerPhone(e.target.value)}
                        className="w-full pl-16 pr-4 py-3 text-sm bg-white border border-zinc-300 rounded-2xl focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 text-zinc-950 font-bold placeholder:text-zinc-400 shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Password & Confirm Password */}
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label htmlFor={passwordId} className="block text-xs font-extrabold text-zinc-800 uppercase tracking-wide">
                            Computer App Password <span className="text-red-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-[11px] text-zinc-600 hover:text-zinc-950 font-bold cursor-pointer"
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
                          className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-2xl focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 text-zinc-950 font-bold placeholder:text-zinc-400 shadow-2xs"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label htmlFor={confirmPasswordId} className="block text-xs font-extrabold text-zinc-800 uppercase tracking-wide">
                            Re-type Password <span className="text-red-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="text-[11px] text-zinc-600 hover:text-zinc-950 font-bold cursor-pointer"
                          >
                            {showConfirmPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                        <input
                          id={confirmPasswordId}
                          type={showConfirmPassword ? "text" : "password"}
                          required
                          placeholder="Confirm password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-2xl focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 text-zinc-950 font-bold placeholder:text-zinc-400 shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* Password Strength Indicator */}
                    {password && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-zinc-600">Password Quality:</span>
                          <span className="font-bold text-zinc-950">
                            {strengthLabels[Math.max(0, passwordStrengthScore - 1)]}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[0, 1, 2, 3].map((idx) => (
                            <div
                              key={idx}
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                idx < passwordStrengthScore
                                  ? strengthColors[passwordStrengthScore - 1]
                                  : "bg-zinc-200"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Criteria check pills */}
                    <div className="flex flex-wrap gap-2 text-[11px] pt-1">
                      <span className={`px-2.5 py-1 rounded-xl font-bold ${passwordCriteria.length ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"}`}>
                        {passwordCriteria.length ? "✓" : "○"} 8+ letters
                      </span>
                      <span className={`px-2.5 py-1 rounded-xl font-bold ${passwordCriteria.hasUpper ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"}`}>
                        {passwordCriteria.hasUpper ? "✓" : "○"} Capital letter
                      </span>
                      <span className={`px-2.5 py-1 rounded-xl font-bold ${passwordCriteria.hasNumber ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"}`}>
                        {passwordCriteria.hasNumber ? "✓" : "○"} Number (0-9)
                      </span>
                      <span className={`px-2.5 py-1 rounded-xl font-bold ${passwordCriteria.match ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"}`}>
                        {passwordCriteria.match ? "✓" : "○"} Passwords match
                      </span>
                    </div>

                    <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-[11px] text-zinc-600 leading-relaxed font-medium">
                      💡 You will use your email (<code>{googleUser.email}</code>) and this password to sign into the Printap app on your shop counter computer.
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-4 px-6 bg-zinc-950 hover:bg-zinc-800 text-white font-black text-sm sm:text-base rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01]"
                  >
                    <span>Continue to Step 2 (Shop Location)</span>
                    <span>→</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: STORE LOCATION & ADDRESS */}
            {currentStep === 2 && (
              <form onSubmit={handleProceedToStep3} className="bg-white rounded-3xl p-6 sm:p-9 border border-zinc-200 shadow-sm space-y-7 animate-fade-in-up">
                <div className="border-b border-zinc-100 pb-4">
                  <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">
                    Step 2 of 3
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 mt-1">Where is your shop located?</h2>
                  <p className="text-xs text-zinc-600 mt-1 leading-relaxed font-medium">
                    Pin your shop on the map so nearby students and walk-in customers can find your counter.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-extrabold text-zinc-800 uppercase tracking-wide">
                    Select Shop on Map <span className="text-red-500">*</span>
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
                    <label htmlFor={addressId} className="block text-xs font-extrabold text-zinc-800">
                      Street Address or Landmark
                    </label>
                    <input
                      id={addressId}
                      type="text"
                      placeholder="e.g. Shop #4, Ground Floor, Near University North Gate"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-2xl focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 text-zinc-900 font-medium placeholder:text-zinc-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor={cityId} className="block text-xs font-extrabold text-zinc-800">
                      City
                    </label>
                    <input
                      id={cityId}
                      type="text"
                      placeholder="e.g. Bangalore"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-2xl focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 text-zinc-900 font-medium placeholder:text-zinc-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor={stateId} className="block text-xs font-extrabold text-zinc-800">
                      State
                    </label>
                    <input
                      id={stateId}
                      type="text"
                      placeholder="e.g. Karnataka"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-2xl focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 text-zinc-900 font-medium placeholder:text-zinc-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor={pincodeId} className="block text-xs font-extrabold text-zinc-800">
                      Pincode
                    </label>
                    <input
                      id={pincodeId}
                      type="text"
                      placeholder="e.g. 560038"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-2xl focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 text-zinc-900 font-medium placeholder:text-zinc-400"
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
                    className="py-3.5 px-6 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-sm font-extrabold rounded-2xl transition-colors cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3.5 px-6 bg-zinc-950 hover:bg-zinc-800 text-white font-black text-sm sm:text-base rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01]"
                  >
                    <span>Continue to Step 3 (Payment Details)</span>
                    <span>→</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: DIRECT UPI PAYOUT & LAUNCH */}
            {currentStep === 3 && (
              <form onSubmit={handleFinalizeShop} className="bg-white rounded-3xl p-6 sm:p-9 border border-zinc-200 shadow-sm space-y-7 animate-fade-in-up">
                <div className="border-b border-zinc-100 pb-4">
                  <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">
                    Step 3 of 3
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 mt-1">Where should customer payments go?</h2>
                  <p className="text-xs text-zinc-600 mt-1 leading-relaxed font-medium">
                    Enter the UPI ID of your shop. 100% of customer payments will be deposited directly into your bank account.
                  </p>
                </div>

                {/* UPI VPA ID Input */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor={upiId} className="block text-xs font-extrabold text-zinc-800 uppercase tracking-wide">
                      Shop UPI ID <span className="text-red-500">*</span>
                    </label>
                    {upiVpa && (
                      isUpiValid ? (
                        <span className="text-[11px] text-zinc-900 font-bold bg-zinc-100 px-2.5 py-0.5 rounded-full border border-zinc-200">
                          ✓ Valid UPI format
                        </span>
                      ) : upiBlurred ? (
                        <span className="text-[11px] text-red-500 font-bold">
                          Must include @ (e.g. name@okaxis)
                        </span>
                      ) : null
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-black text-zinc-400 select-none">
                      ₹
                    </span>
                    <input
                      id={upiId}
                      type="text"
                      required
                      placeholder="e.g. apexprints@okaxis, shop@okhdfcbank"
                      value={upiVpa}
                      onChange={(e) => setUpiVpa(e.target.value)}
                      onBlur={() => setUpiBlurred(true)}
                      className={`w-full pl-9 pr-4 py-3.5 text-base font-mono bg-white border rounded-2xl focus:ring-2 text-zinc-950 placeholder:text-zinc-400 transition-all font-bold ${
                        upiVpa && upiBlurred
                          ? isUpiValid
                            ? "border-zinc-950 focus:ring-zinc-950"
                            : "border-red-400 focus:ring-red-400"
                          : "border-zinc-300 focus:ring-zinc-950 focus:border-zinc-950"
                      }`}
                    />
                  </div>

                  <p className="text-xs text-zinc-500 font-medium">
                    Works with Google Pay, PhonePe, Paytm, BHIM, Axis, ICICI, SBI, and HDFC.
                  </p>
                </div>

                {/* Zero Commission Card */}
                <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center shrink-0 font-black text-lg">
                    ₹
                  </div>
                  <div className="text-xs text-zinc-800 space-y-1 text-left">
                    <div className="font-extrabold text-sm text-zinc-950">Direct Payments to Your Bank</div>
                    <p className="leading-relaxed text-zinc-600 font-medium">
                      When a customer pays via UPI QR code, the funds are deposited directly into your bank account.
                      <strong> Printap takes 0% commission and holds zero money.</strong>
                    </p>
                  </div>
                </div>

                {/* Summary Card */}
                <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-5 text-xs space-y-3">
                  <div className="font-extrabold text-zinc-950 uppercase tracking-wider text-[11px] flex items-center justify-between">
                    <span>Summary</span>
                    <span className="text-zinc-600 font-bold">Ready to finish</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-zinc-600 font-medium pt-1 text-left">
                    <div>Shop: <span className="font-bold text-zinc-950 block truncate">{shopName}</span></div>
                    <div>Link: <span className="font-mono font-bold text-zinc-950 block truncate">{slug}.mellod.in</span></div>
                    <div>Owner: <span className="font-bold text-zinc-950 block truncate">{googleUser.name}</span></div>
                    <div>Email: <span className="font-bold text-zinc-950 block truncate">{googleUser.email}</span></div>
                    <div className="col-span-2">
                      Location: <span className="text-zinc-950 block truncate font-bold">{address || `${city || ""} ${state || ""}` || "Coordinates pinned on map"}</span>
                    </div>
                  </div>
                </div>

                {/* Legal Terms Acknowledgment */}
                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-xs text-zinc-600 leading-relaxed text-left flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="terms-consent"
                    required
                    defaultChecked
                    className="mt-0.5 w-4 h-4 rounded text-zinc-900 focus:ring-zinc-950 border-zinc-300 cursor-pointer"
                  />
                  <label htmlFor="terms-consent" className="cursor-pointer select-none">
                    I agree to the{" "}
                    <Link
                      href="/terms"
                      target="_blank"
                      className="text-zinc-950 font-bold underline underline-offset-2 hover:text-zinc-700"
                    >
                      Terms and Conditions
                    </Link>
                    ,{" "}
                    <Link
                      href="/privacy"
                      target="_blank"
                      className="text-zinc-950 font-bold underline underline-offset-2 hover:text-zinc-700"
                    >
                      Privacy Policy
                    </Link>
                    , and{" "}
                    <Link
                      href="/refund-policy"
                      target="_blank"
                      className="text-zinc-950 font-bold underline underline-offset-2 hover:text-zinc-700"
                    >
                      Refund &amp; Cancellation Policy
                    </Link>
                    . I confirm that I am authorized to operate this print shop and accept direct UPI payments.
                  </label>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStepError(null);
                      setCurrentStep(2);
                    }}
                    className="py-3.5 px-6 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-sm font-extrabold rounded-2xl transition-colors cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-4 px-6 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-white font-black text-sm sm:text-base rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01]"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span>Creating Your Shop...</span>
                      </>
                    ) : (
                      <>
                        <span>Finish Setup & Download Computer App →</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* RIGHT COLUMN: INTERACTIVE LIVE DUAL-MODE SIMULATOR */}
          <div className="lg:col-span-5 sticky top-8 space-y-4 hidden lg:block">
            <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-5">
              {/* Simulator Header & View Switcher */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
                  How It Looks
                </span>
                <div className="flex items-center p-1 bg-zinc-100 rounded-2xl border border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setPreviewTab("mobile")}
                    className={`px-3 py-1 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                      previewTab === "mobile"
                        ? "bg-white text-zinc-950 shadow-2xs"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    📱 Customer View
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab("terminal")}
                    className={`px-3 py-1 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                      previewTab === "terminal"
                        ? "bg-white text-zinc-950 shadow-2xs"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    🖥️ Counter Computer
                  </button>
                </div>
              </div>

              {/* TAB 1: 📱 CUSTOMER PHONE PREVIEW */}
              {previewTab === "mobile" && (
                <div className="bg-white rounded-3xl border-2 border-zinc-200 shadow-md overflow-hidden animate-fade-in-up">
                  {/* Phone Bezel Header */}
                  <div className="bg-zinc-100 px-4 py-2 border-b border-zinc-200 flex items-center justify-between text-[10px] font-bold text-zinc-500">
                    <span>9:41</span>
                    <div className="w-14 h-3 bg-zinc-800 rounded-full"></div>
                    <div className="flex items-center gap-1">
                      <span>5G</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Browser URL Capsule */}
                  <div className="bg-zinc-50 px-3.5 py-2 border-b border-zinc-200 flex items-center gap-2">
                    <div className="flex-1 bg-white px-3 py-1 rounded-xl text-[10px] font-mono text-zinc-800 border border-zinc-200 truncate flex items-center gap-1.5">
                      <span>🔒</span>
                      <span className="truncate font-bold">{slug ? `${slug}.mellod.in` : "your-shop.mellod.in"}</span>
                    </div>
                  </div>

                  {/* Mobile Storefront Body */}
                  <div className="p-5 space-y-4 text-left">
                    <div className="flex items-center gap-3">
                      <img src="/P.png" alt="Printap" className="w-9 h-9 rounded-xl shadow-xs" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-sm text-zinc-950 truncate">
                          {shopName || "Your Print Shop"}
                        </h4>
                        <p className="text-[11px] text-zinc-500 truncate font-medium">
                          {city ? `${city}${state ? `, ${state}` : ""}` : "Instant Document Printing"}
                        </p>
                      </div>
                    </div>

                    {/* Customer Drop Zone Simulation */}
                    <div className="border-2 border-dashed border-zinc-300 rounded-2xl p-4 text-center bg-zinc-50 hover:bg-white transition-colors">
                      <div className="text-xs font-bold text-zinc-800">Tap to upload your document</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5 font-medium">PDF, Word, or Photos</div>
                    </div>

                    {/* Order Item */}
                    <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 flex items-center justify-between text-[11px]">
                      <div className="truncate">
                        <span className="font-bold text-zinc-900 block truncate">College_Admit_Card.pdf</span>
                        <span className="text-zinc-500 text-[10px]">1 Page • Black & White</span>
                      </div>
                      <span className="font-black text-zinc-950 shrink-0">₹2.00</span>
                    </div>

                    {/* UPI Box */}
                    <div className="bg-zinc-100 border border-zinc-200 rounded-2xl p-3 flex items-center gap-3">
                      <div className="w-9 h-9 bg-white rounded-xl border border-zinc-200 flex items-center justify-center font-bold text-xs">
                        QR
                      </div>
                      <div className="text-[10px] text-zinc-800 min-w-0">
                        <div className="font-bold truncate">Pay directly via UPI</div>
                        <div className="text-zinc-500 font-mono truncate">{upiVpa || "your-upi@bank"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: 🖥️ COUNTER AGENT TERMINAL SIMULATOR */}
              {previewTab === "terminal" && (
                <div className="bg-zinc-950 text-zinc-100 rounded-3xl border border-zinc-800 shadow-xl overflow-hidden animate-fade-in-up font-mono">
                  {/* Windows Terminal Title Bar */}
                  <div className="bg-zinc-900 px-3.5 py-2 border-b border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span className="font-bold text-zinc-200">Printap Counter App</span>
                    </div>
                    <div className="flex items-center gap-2 select-none text-zinc-500">
                      <span>—</span>
                      <span>▢</span>
                      <span>✕</span>
                    </div>
                  </div>

                  {/* Terminal Status Readout */}
                  <div className="p-4 space-y-3.5 text-xs text-left">
                    <div className="p-2.5 bg-zinc-900 rounded-xl border border-zinc-800 space-y-1">
                      <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Counter Status</div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-200 font-bold truncate">{shopName || "Print Shop"}</span>
                        <span className="text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-800">
                          Ready to Print
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate">Link: {slug || "your-shop"}.mellod.in</div>
                    </div>

                    <div className="p-2.5 bg-zinc-900 rounded-xl border border-zinc-800 space-y-1">
                      <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Connected Printer</div>
                      <div className="text-zinc-200 font-bold text-[11px]">HP LaserJet Pro / Canon Printer</div>
                    </div>

                    {/* Incoming Jobs Mock Ticker */}
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Recent Prints</div>
                      <div className="space-y-1 text-[11px]">
                        <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800 flex items-center justify-between">
                          <span className="text-zinc-300">#102 Admit_Card.pdf</span>
                          <span className="text-emerald-400 font-bold">Printed ✓</span>
                        </div>
                        <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800 flex items-center justify-between">
                          <span className="text-zinc-300">#101 Resume_Final.pdf</span>
                          <span className="text-zinc-400">Ready to print</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Counter Terminal Info Capsule */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-xs space-y-1.5 text-left">
                <div className="font-extrabold text-zinc-900 text-[11px] uppercase tracking-wider">
                  Counter Sign-In Details
                </div>
                <div className="text-zinc-600 text-[11px]">
                  Sign into your shop computer app using: <strong className="text-zinc-950 font-mono">{googleUser.email}</strong>
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
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <OnboardContent />
    </Suspense>
  );
}

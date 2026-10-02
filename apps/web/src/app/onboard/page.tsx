"use client";

import React, { useState, useEffect, useCallback, useId, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
      <div className="w-full h-[340px] rounded-3xl bg-zinc-100/90 flex flex-col items-center justify-center text-xs text-zinc-500 font-medium animate-pulse border border-zinc-200/90 gap-3 shadow-inner">
        <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
        <span className="font-bold text-zinc-700">Loading High-Precision Interactive Map...</span>
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

  const strengthLabels = ["Weak", "Fair", "Good", "Bulletproof"];
  const strengthColors = ["bg-red-500", "bg-amber-500", "bg-indigo-500", "bg-emerald-500"];

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
      email: "alex.printshop@gmail.com",
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
      <div className="min-h-screen bg-mesh flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 animate-fade-in-up">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-3xl bg-indigo-500/25 blur-xl animate-pulse"></div>
            <div className="relative w-16 h-16 rounded-3xl bg-white border border-zinc-200/90 shadow-xl flex items-center justify-center text-indigo-600">
              <svg className="w-7 h-7 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-xs font-black tracking-widest uppercase text-zinc-800">
              Initializing Partner Portal
            </div>
            <div className="text-[11px] text-zinc-400 font-medium">Securing cloud handshake...</div>
          </div>
        </div>
      </div>
    );
  }

  // RENDER: STEP 0 - LUXURY 2-COLUMN SIGN IN SHOWCASE (WHEN NOT LOGGED IN)
  if (!googleUser) {
    return (
      <div className="min-h-screen bg-mesh py-12 sm:py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden flex items-center justify-center">
        {/* Ambient Gradient Auroras */}
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-tr from-indigo-500/15 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-bl from-emerald-500/15 via-teal-500/10 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center relative z-10">
          {/* LEFT COLUMN: THE VALUE PROPOSITION & BRAND PROMISE */}
          <div className="lg:col-span-7 space-y-8 text-left animate-fade-in-up">
            {/* Super Header Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/90 border border-zinc-200/90 shadow-xs backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-black text-zinc-800 tracking-wider uppercase">
                Official Shop Partner Network • Printap OS
              </span>
            </div>

            {/* Hero Heading */}
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-zinc-950 tracking-tight leading-[1.08]">
                Transform your print counter into an{" "}
                <span className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 bg-clip-text text-transparent">
                  autonomous powerhouse.
                </span>
              </h1>
              <p className="text-base sm:text-lg text-zinc-600 max-w-xl leading-relaxed font-normal">
                Give customers an instant upload link right on their smartphones. Auto-print jobs directly to your counter printers with 100% direct UPI settlement into your bank account.
              </p>
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="glass-strong rounded-3xl p-5 border border-zinc-200/90 shadow-xs space-y-2.5 hover:border-indigo-300 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100/80 text-indigo-600 flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform">
                  🌐
                </div>
                <div className="font-extrabold text-sm text-zinc-900">Branded Web Link</div>
                <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                  Auto-assigned <code>shop.mellod.in</code> URL. Zero customer apps or logins needed.
                </p>
              </div>

              <div className="glass-strong rounded-3xl p-5 border border-zinc-200/90 shadow-xs space-y-2.5 hover:border-emerald-300 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100/80 text-emerald-600 flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform">
                  ⚡
                </div>
                <div className="font-extrabold text-sm text-zinc-900">Auto Print Queue</div>
                <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                  Incoming files pop up on your Windows PC ready for instant 1-click counter printing.
                </p>
              </div>

              <div className="glass-strong rounded-3xl p-5 border border-zinc-200/90 shadow-xs space-y-2.5 hover:border-teal-300 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100/80 text-teal-600 flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform">
                  ₹
                </div>
                <div className="font-extrabold text-sm text-zinc-900">100% Direct UPI</div>
                <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                  Direct customer-to-bank settlement. Zero platform fee or fund withholding.
                </p>
              </div>
            </div>

            {/* Metric Proof Badges */}
            <div className="pt-2 flex items-center gap-6 sm:gap-10 border-t border-zinc-200/80 text-left">
              <div>
                <div className="text-2xl sm:text-3xl font-black text-zinc-950">100%</div>
                <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                  Direct P2P Payout
                </div>
              </div>
              <div className="h-9 w-px bg-zinc-200"></div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-zinc-950">&lt; 15s</div>
                <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                  Queue Turnaround
                </div>
              </div>
              <div className="h-9 w-px bg-zinc-200"></div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-zinc-950">0%</div>
                <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                  Platform Commission
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: LUXURY FROSTED SIGN-IN CARD */}
          <div className="lg:col-span-5 w-full max-w-md mx-auto animate-fade-in-up">
            <div className="glass-strong rounded-3xl p-8 sm:p-10 border border-zinc-200/90 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.08)] space-y-7 text-center relative backdrop-blur-3xl">
              {/* Brand Emblem */}
              <div className="space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-emerald-500 flex items-center justify-center text-white font-black text-2xl mx-auto shadow-xl shadow-indigo-600/25">
                  P
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
                  Shop Partner Portal
                </h2>
                <p className="text-xs text-zinc-600 max-w-xs mx-auto leading-relaxed font-medium">
                  Sign in with Google to provision your store URL, configure your counter agent, and receive customer payments.
                </p>
              </div>

              {stepError && (
                <div className="p-3.5 bg-red-50/90 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold text-center animate-shake">
                  {stepError}
                </div>
              )}

              {/* The Master Google OAuth Button */}
              <div className="space-y-4 pt-1">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="w-full py-4 px-6 bg-white hover:bg-zinc-50 active:bg-zinc-100 text-zinc-900 font-extrabold border border-zinc-300 hover:border-zinc-400 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-3 text-sm sm:text-base cursor-pointer disabled:opacity-50 group hover:scale-[1.01]"
                >
                  <svg className="w-5 h-5 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
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

                {/* Instant Dev / Preview Mode */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleDevPreviewLogin}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  >
                    <span>⚡ Instant Dev / Preview Access</span>
                  </button>
                </div>
              </div>

              {/* Trust Badge Footer */}
              <div className="pt-5 border-t border-zinc-100 flex items-center justify-center gap-4 text-[11px] text-zinc-500 font-semibold">
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 1a9 9 0 100 18 9 9 0 000-18zm3.707 7.707a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Google OAuth 2.0
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  256-bit TLS Encrypted
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // RENDER: STEPPED FLOW (AFTER GOOGLE OAUTH 2.0 LOGIN)
  return (
    <div className="min-h-screen bg-mesh py-8 sm:py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle Aurora Ambient Lights */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-6xl mx-auto space-y-7 relative z-10">
        {/* Brand Bar & Authenticated Account Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-strong rounded-3xl p-4 sm:px-6 border border-zinc-200/90 shadow-xs">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center text-white font-black text-xl shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
              P
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-zinc-950 group-hover:text-indigo-600 transition-colors">
                Printap
              </span>
              <span className="text-[10px] text-zinc-400 block font-bold -mt-1 tracking-wider uppercase">
                Shop Registration
              </span>
            </div>
          </Link>

          {/* Verified Google Account Capsule */}
          <div className="flex items-center gap-3.5 bg-white/95 px-3.5 py-2 rounded-2xl border border-zinc-200/90 shadow-2xs">
            {googleUser.avatarUrl ? (
              <img
                src={googleUser.avatarUrl}
                alt={googleUser.name}
                className="w-8 h-8 rounded-full border border-zinc-200 shadow-2xs shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs shrink-0">
                {googleUser.name[0]?.toUpperCase()}
              </div>
            )}
            <div className="text-left min-w-0">
              <div className="text-xs font-black text-zinc-900 flex items-center gap-1.5 truncate">
                <span className="truncate">{googleUser.name}</span>
                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded-full shrink-0 flex items-center gap-0.5">
                  ✓ Verified
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 font-mono truncate">{googleUser.email}</div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs text-zinc-400 hover:text-zinc-700 font-bold px-2 py-1 rounded-lg hover:bg-zinc-100 transition-colors shrink-0 cursor-pointer"
            >
              Switch
            </button>
          </div>
        </div>

        {/* STEP PROGRESS TRACKER CAPSULE */}
        <div className="glass-strong rounded-3xl p-4 sm:p-5 border border-zinc-200/90 shadow-xs max-w-3xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: "Store & Terminal", icon: "🏬" },
              { num: 2, label: "Location & Map", icon: "📍" },
              { num: 3, label: "UPI & Launch", icon: "💳" },
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
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-2xl transition-all ${
                      isCurrent
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25 scale-[1.02]"
                        : isDone
                        ? "hover:bg-emerald-50 text-emerald-800"
                        : "text-zinc-400"
                    } ${canClick ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                        isCurrent
                          ? "bg-white text-indigo-700 shadow-xs"
                          : isDone
                          ? "bg-emerald-500 text-white shadow-xs"
                          : "bg-zinc-100 text-zinc-400"
                      }`}
                    >
                      {isDone ? "✓" : step.num}
                    </div>
                    <div className="text-left hidden sm:block">
                      <div className="text-xs font-black leading-tight">
                        {step.label}
                      </div>
                    </div>
                  </button>
                  {idx < 2 && (
                    <div
                      className={`flex-1 h-1 mx-2 sm:mx-4 rounded-full transition-all ${
                        currentStep > idx + 1 ? "bg-emerald-500" : "bg-zinc-200"
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Progress Percentage Micro-Indicator */}
          <div className="flex items-center justify-between text-[11px] text-zinc-500 font-semibold px-1">
            <span>Step {currentStep} of 3</span>
            <span className="text-indigo-600 font-extrabold">
              {currentStep === 1 ? "33% Complete" : currentStep === 2 ? "66% Complete" : "Almost Ready to Launch!"}
            </span>
          </div>
        </div>

        {/* Global Error Banner */}
        {stepError && (
          <div className="max-w-3xl mx-auto p-4 bg-red-50/90 border border-red-200 text-red-800 rounded-2xl text-xs font-bold flex items-center gap-3 shadow-xs animate-shake">
            <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="flex-1">{stepError}</span>
            <button
              type="button"
              onClick={() => setStepError(null)}
              className="text-red-400 hover:text-red-700 font-black text-sm cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* MAIN CONTAINER: 2-COLUMN LUXURY LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-6xl mx-auto">
          {/* LEFT COLUMN: ACTIVE STEP FORM & PROGRESSIVE COMPLETED BADGES */}
          <div className="lg:col-span-7 space-y-5">
            {/* COMPLETED STEPS SUMMARY CHIPS (Appear sequentially above active step) */}
            {currentStep > 1 && (
              <div className="space-y-2.5">
                <div className="glass-strong rounded-2xl p-4 border border-emerald-200/90 bg-emerald-50/40 flex items-center justify-between text-xs transition-all shadow-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0">
                      ✓
                    </span>
                    <div>
                      <div className="font-extrabold text-zinc-950 flex items-center gap-2">
                        <span>{shopName}</span>
                        <span className="text-emerald-800 font-mono text-[11px] bg-emerald-100/90 px-2 py-0.5 rounded-full font-bold">
                          {slug}.mellod.in
                        </span>
                      </div>
                      <div className="text-zinc-500 text-[11px] font-medium">
                        Terminal credentials locked & ready
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStepError(null);
                      setCurrentStep(1);
                    }}
                    className="text-indigo-600 hover:text-indigo-800 font-bold px-3 py-1.5 rounded-xl hover:bg-indigo-50/80 transition-colors text-xs cursor-pointer"
                  >
                    Edit
                  </button>
                </div>

                {currentStep > 2 && (
                  <div className="glass-strong rounded-2xl p-4 border border-emerald-200/90 bg-emerald-50/40 flex items-center justify-between text-xs transition-all shadow-xs">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0">
                        ✓
                      </span>
                      <div>
                        <div className="font-extrabold text-zinc-950">
                          {city ? `${city}${state ? `, ${state}` : ""}` : "Store Location Pinpointed"}
                        </div>
                        <div className="text-zinc-500 text-[11px] truncate max-w-xs font-medium">
                          {address || (latitude && longitude ? `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}` : "")}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStepError(null);
                        setCurrentStep(2);
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-bold px-3 py-1.5 rounded-xl hover:bg-indigo-50/80 transition-colors text-xs cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 1: STORE DETAILS & TERMINAL PASSWORD */}
            {currentStep === 1 && (
              <form onSubmit={handleProceedToStep2} className="glass-strong rounded-3xl p-6 sm:p-9 border border-zinc-200/90 shadow-sm space-y-7 animate-fade-in-up">
                <div className="border-b border-zinc-100 pb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">
                      Step 1 of 3 • Store Profile
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                      ● Google Account Linked
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 mt-1">Shop Details & Terminal Access</h2>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed font-medium">
                    Name your print counter. Your permanent customer upload link will be automatically generated with guaranteed uniqueness.
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Shop Name */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor={shopNameId} className="block text-xs font-extrabold text-zinc-800 uppercase tracking-wide">
                        Shop / Business Name <span className="text-red-500">*</span>
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
                      placeholder="e.g. Apex Digital Print & Xerox"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      className="w-full px-4.5 py-3.5 text-base bg-white border border-zinc-300 rounded-2xl focus:ring-3 focus:ring-indigo-500/20 focus:border-indigo-600 text-zinc-950 font-bold placeholder:text-zinc-400 placeholder:font-normal shadow-2xs transition-all"
                    />
                  </div>

                  {/* Auto-Assigned Subdomain Live Card (NON-CUSTOMISABLE AS REQUESTED) */}
                  <div className="bg-gradient-to-br from-indigo-50/80 via-purple-50/40 to-white border border-indigo-200/80 rounded-3xl p-5 space-y-3.5 shadow-xs">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-indigo-950 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                        Permanent Subdomain URL
                      </span>
                      {slugState.checking ? (
                        <span className="text-[11px] text-indigo-600 font-bold flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Checking collision...
                        </span>
                      ) : slug ? (
                        <span className="text-[11px] text-emerald-800 font-extrabold bg-emerald-100/90 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                          <span>✓ Guaranteed Collision-Free</span>
                          {slugState.wasAdjusted && <span className="text-zinc-500 font-medium">(auto-numbered)</span>}
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-400 font-medium">Type store name above</span>
                      )}
                    </div>

                    {/* Simulated macOS / Safari Address Bar */}
                    <div className="flex items-center gap-2.5 bg-white px-4 py-3 rounded-2xl border border-indigo-200/90 shadow-xs">
                      <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      <div className="font-mono text-xs sm:text-sm text-indigo-700 font-black truncate flex-1">
                        {slug ? `https://${slug}.mellod.in` : "https://your-shop.mellod.in"}
                      </div>
                      {slug && (
                        <button
                          type="button"
                          onClick={handleCopySlug}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
                        >
                          {copiedSlug ? "Copied! ✓" : "Copy"}
                        </button>
                      )}
                      <span className="text-[10px] text-zinc-500 font-extrabold select-none bg-zinc-100 px-2.5 py-1 rounded-lg">
                        100% Automated
                      </span>
                    </div>

                    <p className="text-[11px] text-indigo-950/70 leading-relaxed font-medium">
                      Subdomains are permanently auto-assigned to maintain collision-free global routing. Customers open this web link on their phones to upload files and print directly at your counter.
                    </p>
                  </div>

                  {/* Owner Phone */}
                  <div className="space-y-2">
                    <label htmlFor={ownerPhoneId} className="block text-xs font-extrabold text-zinc-800 uppercase tracking-wide">
                      Counter Phone Number <span className="text-zinc-400 font-normal">(Optional)</span>
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
                        className="w-full pl-16 pr-4 py-3 text-sm bg-white border border-zinc-300 rounded-2xl focus:ring-3 focus:ring-indigo-500/20 focus:border-indigo-600 text-zinc-950 font-bold placeholder:text-zinc-400 placeholder:font-normal shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Terminal Password & Confirm Password */}
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Password */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label htmlFor={passwordId} className="block text-xs font-extrabold text-zinc-800 uppercase tracking-wide">
                            Terminal Password <span className="text-red-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
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
                          className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-2xl focus:ring-3 focus:ring-indigo-500/20 focus:border-indigo-600 text-zinc-950 font-bold placeholder:text-zinc-400 placeholder:font-normal shadow-2xs"
                        />
                      </div>

                      {/* Confirm Password */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label htmlFor={confirmPasswordId} className="block text-xs font-extrabold text-zinc-800 uppercase tracking-wide">
                            Confirm Password <span className="text-red-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                          >
                            {showConfirmPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                        <input
                          id={confirmPasswordId}
                          type={showConfirmPassword ? "text" : "password"}
                          required
                          placeholder="Re-enter password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-2xl focus:ring-3 focus:ring-indigo-500/20 focus:border-indigo-600 text-zinc-950 font-bold placeholder:text-zinc-400 placeholder:font-normal shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* Interactive Password Strength Indicator */}
                    {password && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-zinc-600">Password Strength:</span>
                          <span
                            className={`font-black uppercase tracking-wider ${
                              passwordStrengthScore <= 1
                                ? "text-red-600"
                                : passwordStrengthScore === 2
                                ? "text-amber-600"
                                : passwordStrengthScore === 3
                                ? "text-indigo-600"
                                : "text-emerald-600"
                            }`}
                          >
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

                    {/* Password Criteria Badges */}
                    <div className="flex flex-wrap gap-2 text-[11px] pt-1">
                      <span
                        className={`px-2.5 py-1 rounded-xl font-bold transition-all flex items-center gap-1 ${
                          passwordCriteria.length ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {passwordCriteria.length ? "✓" : "○"} 8+ characters
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-xl font-bold transition-all flex items-center gap-1 ${
                          passwordCriteria.hasUpper ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {passwordCriteria.hasUpper ? "✓" : "○"} Uppercase letter
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-xl font-bold transition-all flex items-center gap-1 ${
                          passwordCriteria.hasNumber ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {passwordCriteria.hasNumber ? "✓" : "○"} Number (0-9)
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-xl font-bold transition-all flex items-center gap-1 ${
                          passwordCriteria.match ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {passwordCriteria.match ? "✓" : "○"} Passwords match
                      </span>
                    </div>

                    <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-2xl text-[11px] text-zinc-600 leading-relaxed font-medium">
                      💡 You will use your Google email (<code>{googleUser.email}</code>) and this password to log in to the <strong>Printap Desktop Counter Terminal</strong>.
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer hover:scale-[1.01]"
                  >
                    <span>Continue to Store Location</span>
                    <span>→</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: STORE GEOLOCATION & ADDRESS */}
            {currentStep === 2 && (
              <form onSubmit={handleProceedToStep3} className="glass-strong rounded-3xl p-6 sm:p-9 border border-zinc-200/90 shadow-sm space-y-7 animate-fade-in-up">
                <div className="border-b border-zinc-100 pb-4">
                  <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">
                    Step 2 of 3 • Location
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 mt-1">Store Geolocation & Address</h2>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed font-medium">
                    Pinpoint your store on the interactive map so nearby students, customers, and campus walk-ins can find your counter.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-extrabold text-zinc-800 uppercase tracking-wide">
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
                    <label htmlFor={addressId} className="block text-xs font-extrabold text-zinc-800">
                      Street Address / Building Landmark
                    </label>
                    <input
                      id={addressId}
                      type="text"
                      placeholder="e.g. Shop #4, Ground Floor, Near University North Gate"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-2xl focus:ring-3 focus:ring-indigo-500/20 focus:border-indigo-600 text-zinc-900 font-medium placeholder:text-zinc-400"
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
                      className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-2xl focus:ring-3 focus:ring-indigo-500/20 focus:border-indigo-600 text-zinc-900 font-medium placeholder:text-zinc-400"
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
                      className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-2xl focus:ring-3 focus:ring-indigo-500/20 focus:border-indigo-600 text-zinc-900 font-medium placeholder:text-zinc-400"
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
                      className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-2xl focus:ring-3 focus:ring-indigo-500/20 focus:border-indigo-600 text-zinc-900 font-medium placeholder:text-zinc-400"
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
                    className="flex-1 py-3.5 px-6 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01]"
                  >
                    <span>Continue to UPI Payout</span>
                    <span>→</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: DIRECT UPI PAYOUT & LAUNCH */}
            {currentStep === 3 && (
              <form onSubmit={handleFinalizeShop} className="glass-strong rounded-3xl p-6 sm:p-9 border border-zinc-200/90 shadow-sm space-y-7 animate-fade-in-up">
                <div className="border-b border-zinc-100 pb-4">
                  <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">
                    Step 3 of 3 • UPI Payout & Launch
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 mt-1">Direct Customer UPI Payout</h2>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed font-medium">
                    Enter the UPI ID where 100% of customer print payments will be credited directly to your bank account.
                  </p>
                </div>

                {/* UPI VPA ID Input */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor={upiId} className="block text-xs font-extrabold text-zinc-800 uppercase tracking-wide">
                      Shop Owner UPI ID (VPA) <span className="text-red-500">*</span>
                    </label>
                    {upiVpa && (
                      isUpiValid ? (
                        <span className="text-[11px] text-emerald-700 font-extrabold flex items-center gap-1 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                          ✓ Valid UPI format
                        </span>
                      ) : upiBlurred ? (
                        <span className="text-[11px] text-red-500 font-bold">
                          Must contain @ (e.g. name@okaxis)
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
                      className={`w-full pl-9 pr-4 py-3.5 text-base font-mono bg-white border rounded-2xl focus:ring-3 text-zinc-950 placeholder:text-zinc-400 transition-all font-bold ${
                        upiVpa && upiBlurred
                          ? isUpiValid
                            ? "border-emerald-400 focus:ring-emerald-500/20"
                            : "border-red-400 focus:ring-red-500/20"
                          : "border-zinc-300 focus:ring-indigo-500/20 focus:border-indigo-600"
                      }`}
                    />
                  </div>

                  {/* Supported UPI Providers Badges */}
                  <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px]">
                    <span className="font-bold text-zinc-400 text-[10px] uppercase tracking-wider">Supported:</span>
                    <span className="px-2 py-0.5 rounded-lg bg-zinc-100 text-zinc-600 font-bold">Google Pay</span>
                    <span className="px-2 py-0.5 rounded-lg bg-zinc-100 text-zinc-600 font-bold">PhonePe</span>
                    <span className="px-2 py-0.5 rounded-lg bg-zinc-100 text-zinc-600 font-bold">Paytm</span>
                    <span className="px-2 py-0.5 rounded-lg bg-zinc-100 text-zinc-600 font-bold">BHIM</span>
                    <span className="px-2 py-0.5 rounded-lg bg-zinc-100 text-zinc-600 font-bold">Cred / Axis / HDFC</span>
                  </div>
                </div>

                {/* P2P Direct Settlement Explainer */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 rounded-3xl p-5 flex items-start gap-4 shadow-xs">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 font-black text-lg shadow-xs">
                    ₹
                  </div>
                  <div className="text-xs text-emerald-950 space-y-1 text-left">
                    <div className="font-extrabold text-sm">Direct Peer-to-Peer Settlements</div>
                    <p className="leading-relaxed text-emerald-800/90 font-medium">
                      When a customer pays via UPI QR code, the funds are deposited directly into your bank.
                      <strong> Printap takes zero commission and holds zero funds.</strong>
                    </p>
                  </div>
                </div>

                {/* Digital Passport Summary Card */}
                <div className="bg-zinc-50/90 border border-zinc-200/90 rounded-3xl p-5 text-xs space-y-3 shadow-2xs">
                  <div className="font-extrabold text-zinc-800 uppercase tracking-wider text-[11px] flex items-center justify-between">
                    <span>Store Passport Summary</span>
                    <span className="text-emerald-700 font-black flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Ready to launch
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3.5 text-zinc-600 font-medium pt-1 text-left">
                    <div>Shop: <span className="font-black text-zinc-950 block truncate">{shopName}</span></div>
                    <div>Subdomain: <span className="font-mono font-black text-indigo-600 block truncate">{slug}.mellod.in</span></div>
                    <div>Owner: <span className="font-black text-zinc-950 block truncate">{googleUser.name}</span></div>
                    <div>Login Email: <span className="font-black text-zinc-950 block truncate">{googleUser.email}</span></div>
                    <div className="col-span-2">
                      Location: <span className="text-zinc-900 block truncate font-bold">{address || `${city || ""} ${state || ""}` || "Coordinates pinned on map"}</span>
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
                    className="py-3.5 px-6 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-sm font-extrabold rounded-2xl transition-colors cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-4 px-6 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 disabled:opacity-50 text-white font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2.5 cursor-pointer hover:scale-[1.01]"
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
                        <span>Complete Setup & Download Desktop Terminal 🚀</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* RIGHT COLUMN: INTERACTIVE LIVE DUAL-MODE SIMULATOR */}
          <div className="lg:col-span-5 sticky top-8 space-y-4 hidden lg:block">
            <div className="glass-strong rounded-3xl p-6 border border-zinc-200/90 shadow-xl space-y-5 backdrop-blur-2xl">
              {/* Simulator Header & View Switcher */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black tracking-wider text-zinc-400 uppercase">
                  Live System Preview
                </span>
                <div className="flex items-center p-1 bg-zinc-100 rounded-2xl border border-zinc-200/80">
                  <button
                    type="button"
                    onClick={() => setPreviewTab("mobile")}
                    className={`px-3 py-1 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                      previewTab === "mobile"
                        ? "bg-white text-zinc-950 shadow-xs"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    📱 Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab("terminal")}
                    className={`px-3 py-1 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                      previewTab === "terminal"
                        ? "bg-white text-zinc-950 shadow-xs"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    🖥️ Counter
                  </button>
                </div>
              </div>

              {/* TAB 1: 📱 CUSTOMER MOBILE EXPERIENCE SIMULATOR */}
              {previewTab === "mobile" && (
                <div className="bg-white rounded-3xl border border-zinc-200/90 shadow-lg overflow-hidden animate-fade-in-up">
                  {/* Phone Bezel Header with Dynamic Island */}
                  <div className="bg-zinc-100 px-4 py-2 border-b border-zinc-200/80 flex items-center justify-between text-[10px] font-bold text-zinc-500">
                    <span>9:41</span>
                    <div className="w-16 h-3 bg-zinc-900 rounded-full"></div>
                    <div className="flex items-center gap-1">
                      <span>5G</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Browser URL Capsule */}
                  <div className="bg-zinc-50 px-3.5 py-2 border-b border-zinc-200/80 flex items-center gap-2">
                    <div className="flex-1 bg-white px-3 py-1 rounded-xl text-[10px] font-mono text-zinc-700 border border-zinc-200 truncate flex items-center gap-1.5 shadow-2xs">
                      <svg className="w-3 h-3 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      <span className="truncate font-bold">{slug ? `${slug}.mellod.in` : "your-shop.mellod.in"}</span>
                    </div>
                  </div>

                  {/* Mobile Storefront Body */}
                  <div className="p-5 space-y-4 text-left">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center text-white font-black text-xl shadow-md shadow-indigo-600/20">
                        {shopName ? shopName.charAt(0).toUpperCase() : "P"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-sm text-zinc-950 truncate">
                          {shopName || "Your Print Shop"}
                        </h4>
                        <p className="text-[11px] text-zinc-500 truncate font-medium">
                          {city ? `${city}${state ? `, ${state}` : ""}` : "Instant Peer-to-Peer Document Printing"}
                        </p>
                      </div>
                    </div>

                    {/* Feature Pills */}
                    <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg border border-indigo-100">
                        ⚡ Instant Upload
                      </span>
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-100">
                        ₹ Direct UPI
                      </span>
                      <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-lg border border-purple-100">
                        📄 Auto-Spool
                      </span>
                    </div>

                    {/* Customer Drop Zone Simulation */}
                    <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-4 text-center bg-zinc-50/70 hover:bg-zinc-50 transition-colors">
                      <div className="text-xs font-black text-zinc-800">Tap or drop documents to print</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5 font-medium">PDF, DOCX, PPTX, or Images</div>
                    </div>

                    {/* Simulated Order Item */}
                    <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-200/80 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                          PDF
                        </span>
                        <span className="font-bold text-zinc-800 truncate">Project_Report.pdf</span>
                      </div>
                      <span className="font-black text-emerald-700 shrink-0">₹24.00</span>
                    </div>

                    {/* QR Payment Simulation */}
                    <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl border border-emerald-200 flex items-center justify-center font-bold text-xs shadow-2xs">
                        QR
                      </div>
                      <div className="text-[10px] text-emerald-950 min-w-0">
                        <div className="font-extrabold truncate">Direct UPI Payment</div>
                        <div className="text-emerald-700 font-mono truncate">{upiVpa || "your-upi@bank"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: 🖥️ COUNTER AGENT TERMINAL SIMULATOR */}
              {previewTab === "terminal" && (
                <div className="bg-zinc-950 text-zinc-100 rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden animate-fade-in-up font-mono">
                  {/* Windows Terminal Title Bar */}
                  <div className="bg-zinc-900/90 px-3.5 py-2 border-b border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="font-bold text-zinc-200">Printap Counter Agent v0.0.1</span>
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
                      <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Terminal Connection</div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-200 font-bold truncate">{shopName || "Printap Counter"}</span>
                        <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
                          ● Online
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate">Queue: {slug || "your-shop"}.mellod.in</div>
                    </div>

                    {/* Printer Status */}
                    <div className="p-2.5 bg-zinc-900 rounded-xl border border-zinc-800 space-y-1">
                      <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Local Printer Status</div>
                      <div className="text-zinc-200 font-bold text-[11px]">HP LaserJet Pro MFP / Canon iR-ADV</div>
                      <div className="text-[10px] text-emerald-400">Ready • Auto-Spool Active</div>
                    </div>

                    {/* Incoming Jobs Mock Ticker */}
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Recent Queue Activity</div>
                      <div className="space-y-1 text-[11px]">
                        <div className="p-2 bg-zinc-900/60 rounded-lg border border-zinc-800/80 flex items-center justify-between">
                          <span className="text-zinc-300">#1042 Thesis_Final.pdf</span>
                          <span className="text-emerald-400 font-bold">Auto-Printed ✓</span>
                        </div>
                        <div className="p-2 bg-zinc-900/60 rounded-lg border border-zinc-800/80 flex items-center justify-between">
                          <span className="text-zinc-300">#1041 Resume_2026.docx</span>
                          <span className="text-indigo-400 font-bold">Processing...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Counter Terminal Info Capsule */}
              <div className="bg-zinc-50 border border-zinc-200/90 rounded-2xl p-4 text-xs space-y-2 text-left shadow-2xs">
                <div className="font-extrabold text-zinc-900 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Counter Terminal Login Credentials
                </div>
                <div className="space-y-1 text-zinc-600 font-mono text-[11px]">
                  <div>Login ID: <span className="text-zinc-950 font-bold">{googleUser.email}</span></div>
                  <div>UPI VPA: <span className="text-emerald-700 font-bold">{upiVpa || "Pending setup"}</span></div>
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
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <OnboardContent />
    </Suspense>
  );
}

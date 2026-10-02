"use client";

import React, { useState, useEffect, useCallback, useId } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { sanitizeSubdomain, validateEmail } from "@printap/shared";

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

export default function OnboardPage() {
  // Current Active Step (1: Account, 2: Location, 3: UPI Payout, 4: Verify)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [highestStep, setHighestStep] = useState<number>(1);

  // Step 1: Merged Shop Profile & Owner Account
  const [shopName, setShopName] = useState("");
  const [slug, setSlug] = useState("");
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [slugState, setSlugState] = useState<AutoSlugState>({
    checking: false,
    slug: "",
    url: "",
    wasAdjusted: false,
  });

  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [emailBlurred, setEmailBlurred] = useState(false);
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

  // Step 4: Email OTP Verification
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Global Flow & Notification state
  const [stepError, setStepError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [registeredShop, setRegisteredShop] = useState<{
    name: string;
    slug: string;
    owner_email: string;
    address?: string;
  } | null>(null);

  // Accessibility IDs
  const shopNameId = useId();
  const slugInputId = useId();
  const ownerNameId = useId();
  const ownerPhoneId = useId();
  const ownerEmailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const addressId = useId();
  const cityId = useId();
  const stateId = useId();
  const pincodeId = useId();
  const upiId = useId();

  // Email format check
  const emailValidation = validateEmail(ownerEmail);

  // UPI format check (e.g. name@bank)
  const isUpiValid = Boolean(
    upiVpa.trim().includes("@") &&
      !upiVpa.trim().startsWith("@") &&
      !upiVpa.trim().endsWith("@") &&
      !/\s/.test(upiVpa.trim())
  );

  // Auto-assign unique subdomain based on store name (guaranteed zero duplicates)
  useEffect(() => {
    const cleanName = shopName.trim();
    if (!cleanName || cleanName.length < 2) {
      if (!isEditingSlug) {
        setSlug("");
        setSlugState({ checking: false, slug: "", url: "", wasAdjusted: false });
      }
      return;
    }

    if (isEditingSlug) return; // User manually customising slug

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
    }, 350);

    return () => clearTimeout(timer);
  }, [shopName, isEditingSlug]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

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

  // Validate Step 1 before proceeding to Step 2
  const handleProceedToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setStepError(null);

    if (!shopName.trim()) {
      setStepError("Please enter your business or shop name.");
      return;
    }
    if (!slug.trim()) {
      setStepError("Please wait for your unique subdomain to be generated.");
      return;
    }
    if (!ownerName.trim()) {
      setStepError("Please enter the shop owner's full name.");
      return;
    }
    if (!emailValidation.valid) {
      setStepError(emailValidation.reason || "Please enter a valid owner login email.");
      return;
    }
    if (password.length < 8) {
      setStepError("Password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setStepError("Password must contain at least one uppercase letter and one number.");
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

  // Validate Step 2 before proceeding to Step 3
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

  // Validate Step 3 and Send Verification OTP for Step 4
  const handleProceedToStep4 = async (e: React.FormEvent) => {
    e.preventDefault();
    setStepError(null);

    if (!isUpiValid) {
      setStepError("Please enter a valid UPI VPA ID (e.g. apexprints@okaxis) to receive customer payments.");
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: ownerEmail.trim().toLowerCase(),
          purpose: "onboarding",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStepError(data.error || "Failed to send verification code. Please check the email address.");
        setIsSendingOtp(false);
        return;
      }

      setResendCooldown(60);
      setOtpError(null);
      setOtpDigits(["", "", "", "", "", ""]);
      setHighestStep((prev) => Math.max(prev, 4));
      setCurrentStep(4);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setStepError("Network error while requesting verification code.");
      console.error(err);
    } finally {
      setIsSendingOtp(false);
    }
  };

  // OTP Box Keydown and Auto-advance
  const handleOtpChange = (index: number, value: string) => {
    const clean = value.replace(/[^0-9]/g, "");
    if (!clean) {
      const next = [...otpDigits];
      next[index] = "";
      setOtpDigits(next);
      return;
    }

    if (clean.length > 1) {
      const pasteDigits = clean.slice(0, 6).split("");
      const next = [...otpDigits];
      pasteDigits.forEach((digit, i) => {
        if (i < 6) next[i] = digit;
      });
      setOtpDigits(next);
      const nextFocus = Math.min(pasteDigits.length, 5);
      const elem = document.getElementById(`otp-digit-${nextFocus}`);
      elem?.focus();
      return;
    }

    const next = [...otpDigits];
    next[index] = clean.slice(-1);
    setOtpDigits(next);

    if (index < 5 && clean) {
      const nextInput = document.getElementById(`otp-digit-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      const prevInput = document.getElementById(`otp-digit-${index - 1}`);
      prevInput?.focus();
    }
  };

  // Finalize Registration with OTP
  const handleConfirmOtp = async () => {
    const fullOtp = otpDigits.join("");
    if (fullOtp.length !== 6) {
      setOtpError("Please enter all 6 digits of the verification code.");
      return;
    }

    setOtpSubmitting(true);
    setOtpError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: shopName.trim(),
          slug: slug.trim(),
          ownerName: ownerName.trim(),
          ownerEmail: ownerEmail.trim().toLowerCase(),
          ownerPhone: ownerPhone.trim(),
          password,
          upiVpa: upiVpa.trim(),
          latitude,
          longitude,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          pincode: pincode.trim() || undefined,
          otp: fullOtp,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error || "Failed to complete shop registration.");
        setOtpSubmitting(false);
        return;
      }

      setRegisteredShop(data.shop);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setOtpError("Network connection error during shop registration.");
      console.error(err);
    } finally {
      setOtpSubmitting(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setOtpSubmitting(true);
    setOtpError(null);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: ownerEmail.trim().toLowerCase(),
          purpose: "onboarding",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResendCooldown(60);
      } else {
        setOtpError(data.error || "Failed to resend code.");
      }
    } catch {
      setOtpError("Failed to resend verification code.");
    } finally {
      setOtpSubmitting(false);
    }
  };

  // RENDER: SUCCESS SCREEN
  if (registeredShop) {
    const storefrontUrl = `https://${registeredShop.slug}.mellod.in`;
    return (
      <div className="min-h-screen bg-mesh py-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-xl w-full glass-strong rounded-3xl p-8 sm:p-10 border border-zinc-200/90 shadow-2xl text-center space-y-6 animate-fadeIn">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div>
            <div className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full mb-3 tracking-wide">
              STORE ONBOARDED SUCCESSFULLY
            </div>
            <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">
              {registeredShop.name} is Live!
            </h1>
            <p className="text-sm text-zinc-600 mt-2">
              Your unique branded storefront is active and configured for peer-to-peer customer print jobs.
            </p>
          </div>

          {/* Assigned Subdomain Card */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-left space-y-2">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Your Dedicated Storefront URL
            </div>
            <div className="flex items-center justify-between gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-zinc-200 shadow-sm">
              <span className="font-mono text-sm text-indigo-600 font-bold truncate">
                {storefrontUrl}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(storefrontUrl);
                  alert("Storefront URL copied to clipboard!");
                }}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold rounded-lg transition-colors shrink-0"
              >
                Copy Link
              </button>
            </div>
          </div>

          {/* Counter Terminal Info */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-5 text-left space-y-3">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>Connect Your Counter Terminal</span>
            </div>
            <p className="text-xs text-indigo-800/80 leading-relaxed">
              Launch the <strong>Printap Desktop App</strong> on your counter PC and sign in using your registered credentials:
            </p>
            <div className="bg-white p-3 rounded-xl border border-indigo-200 text-xs space-y-1 font-mono">
              <div><strong className="text-zinc-600">Login Email:</strong> <span className="text-zinc-900 font-bold">{registeredShop.owner_email}</span></div>
              <div><strong className="text-zinc-600">Subdomain:</strong> <span className="text-indigo-600 font-bold">{registeredShop.slug}</span></div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <a
              href={storefrontUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-3 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-600/20 text-center transition-all"
            >
              Visit Storefront →
            </a>
            <Link
              href="/"
              className="py-3 px-5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-sm font-semibold rounded-xl text-center transition-colors"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
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
            Register Your Print Shop
          </h1>
          <p className="text-sm text-zinc-600 max-w-lg mx-auto">
            Get your auto-assigned unique subdomain, direct customer UPI payouts, and real-time print terminal sync.
          </p>
        </div>

        {/* STEP PROGRESS TRACKER */}
        <div className="glass rounded-2xl p-4 border border-zinc-200/90 shadow-sm max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: "Account" },
              { num: 2, label: "Location" },
              { num: 3, label: "UPI Payout" },
              { num: 4, label: "Verify" },
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
                        setCurrentStep(step.num as 1 | 2 | 3 | 4);
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
                  {idx < 3 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 sm:mx-3 transition-all ${
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

        {/* MAIN ONBOARDING CONTAINER: 2-COLUMN ON DESKTOP */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-5xl mx-auto">
          {/* LEFT COLUMN: ACTIVE STEP FORM & PROGRESSIVE COMPLETED CARDS */}
          <div className="lg:col-span-7 space-y-6">
            {/* COMPLETED STEPS SUMMARY ACCORDION BARS (Appear progressively above the active step) */}
            {currentStep > 1 && (
              <div className="space-y-3">
                {/* Step 1 Completed Summary */}
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
                        Owner: {ownerName} • {ownerEmail}
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

                {/* Step 2 Completed Summary */}
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

                {/* Step 3 Completed Summary */}
                {currentStep > 3 && (
                  <div className="glass rounded-2xl p-4 border border-emerald-200/80 bg-emerald-50/30 flex items-center justify-between text-xs transition-all">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                        ✓
                      </span>
                      <div>
                        <div className="font-bold text-zinc-900 flex items-center gap-2">
                          <span>UPI Payout Active</span>
                          <span className="font-mono text-emerald-700 font-bold bg-emerald-100/70 px-2 py-0.5 rounded-full text-[11px]">
                            {upiVpa}
                          </span>
                        </div>
                        <div className="text-zinc-500 text-[11px]">
                          100% direct customer peer-to-peer settlement
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStepError(null);
                        setCurrentStep(3);
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 1: MERGED SHOP & OWNER CREDENTIALS */}
            {currentStep === 1 && (
              <form onSubmit={handleProceedToStep2} className="glass-strong rounded-3xl p-6 sm:p-8 border border-zinc-200 shadow-sm space-y-6 animate-fadeIn">
                <div className="border-b border-zinc-100 pb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                      Step 1 of 4 • Account
                    </span>
                    <span className="text-[11px] text-zinc-400 font-medium">Auto-saves locally</span>
                  </div>
                  <h2 className="text-xl font-extrabold text-zinc-900 mt-1">Shop Details & Owner Login</h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Enter your shop name. We will automatically assign a unique subdomain handle and setup your counter login.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Shop Name */}
                  <div className="space-y-1.5 sm:col-span-2">
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

                  {/* Auto-Assigned Subdomain Live Card */}
                  <div className="sm:col-span-2 bg-gradient-to-br from-indigo-50/80 to-purple-50/50 border border-indigo-100/90 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                        Auto-Assigned Subdomain
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

                    {!isEditingSlug ? (
                      <div className="flex items-center justify-between gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-indigo-200/80 shadow-sm">
                        <div className="font-mono text-xs sm:text-sm text-indigo-700 font-bold truncate">
                          {slug ? `https://${slug}.mellod.in` : "https://your-shop.mellod.in"}
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsEditingSlug(true)}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold underline shrink-0"
                        >
                          Customize
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-zinc-400">https://</span>
                          <input
                            id={slugInputId}
                            type="text"
                            value={slug}
                            onChange={(e) => setSlug(sanitizeSubdomain(e.target.value))}
                            placeholder="custom-slug"
                            className="flex-1 font-mono text-xs sm:text-sm px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900"
                          />
                          <span className="font-mono text-xs text-zinc-500">.mellod.in</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsEditingSlug(false)}
                          className="text-[11px] text-zinc-500 hover:text-zinc-700 font-medium"
                        >
                          Done customising
                        </button>
                      </div>
                    )}

                    <p className="text-[11px] text-indigo-900/70 leading-relaxed">
                      Customers will open this unique branded address on their smartphones to upload and print documents at your counter.
                    </p>
                  </div>

                  {/* Owner Full Name */}
                  <div className="space-y-1.5">
                    <label htmlFor={ownerNameId} className="block text-xs font-bold text-zinc-700">
                      Owner Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id={ownerNameId}
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-900 font-medium placeholder:text-zinc-400"
                    />
                  </div>

                  {/* Owner Phone */}
                  <div className="space-y-1.5">
                    <label htmlFor={ownerPhoneId} className="block text-xs font-bold text-zinc-700">
                      Phone Number
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

                  {/* Owner Email (Terminal Login) */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor={ownerEmailId} className="block text-xs font-bold text-zinc-700">
                        Primary Login Email <span className="text-red-500">*</span>
                      </label>
                      {ownerEmail && (
                        emailValidation.valid ? (
                          <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                            ✓ Valid format
                          </span>
                        ) : emailBlurred || ownerEmail.includes("@") ? (
                          <span className="text-[11px] text-red-500 font-medium">
                            {emailValidation.reason}
                          </span>
                        ) : null
                      )}
                    </div>
                    <input
                      id={ownerEmailId}
                      type="email"
                      required
                      placeholder="e.g. rahul@apexprints.com"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      onBlur={() => setEmailBlurred(true)}
                      className={`w-full px-4 py-2.5 text-sm bg-white border rounded-xl focus:ring-2 text-zinc-900 font-medium placeholder:text-zinc-400 transition-colors ${
                        ownerEmail && (emailBlurred || ownerEmail.includes("@"))
                          ? emailValidation.valid
                            ? "border-emerald-400 focus:ring-emerald-500 focus:border-emerald-500"
                            : "border-red-400 focus:ring-red-500 focus:border-red-500"
                          : "border-zinc-300 focus:ring-indigo-500 focus:border-indigo-500"
                      }`}
                    />
                    <p className="text-[11px] text-zinc-500">
                      You will use this email address to log in to the Counter Terminal Desktop App.
                    </p>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor={passwordId} className="block text-xs font-bold text-zinc-700">
                        Terminal Password <span className="text-red-500">*</span>
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

                  {/* Confirm Password */}
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

                  {/* Password Criteria Badges */}
                  <div className="sm:col-span-2 flex flex-wrap gap-2 text-[11px]">
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
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
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
                    Step 2 of 4 • Location
                  </span>
                  <h2 className="text-xl font-extrabold text-zinc-900 mt-1">Store Geolocation & Address</h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Pinpoint your store on the map so nearby students and campus walk-ins can discover your counter.
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
                      className="w-full px-4 py-2 text-sm bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-900 placeholder:text-zinc-400"
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
                      className="w-full px-4 py-2 text-sm bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-900 placeholder:text-zinc-400"
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
                      className="w-full px-4 py-2 text-sm bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-900 placeholder:text-zinc-400"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
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
                    className="flex-1 py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Continue to UPI Payout</span>
                    <span>→</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: DEDICATED UPI PAYOUT STEP (Final step before email verification) */}
            {currentStep === 3 && (
              <form onSubmit={handleProceedToStep4} className="glass-strong rounded-3xl p-6 sm:p-8 border border-zinc-200 shadow-sm space-y-6 animate-fadeIn">
                <div className="border-b border-zinc-100 pb-4">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                    Step 3 of 4 • UPI Payout
                  </span>
                  <h2 className="text-xl font-extrabold text-zinc-900 mt-1">Direct Customer UPI Payout</h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Enter the UPI Virtual Payment Address (VPA) where customers pay for prints. 100% of revenue goes directly to your bank account.
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
                  <div className="relative">
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
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Works with any bank or UPI app: Google Pay, PhonePe, Paytm, BHIM, Axis, ICICI, etc.
                  </p>
                </div>

                {/* Direct Settlement Callout */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 rounded-2xl p-4 flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-black text-base shadow-sm">
                    ₹
                  </div>
                  <div className="text-xs text-emerald-950 space-y-1">
                    <div className="font-bold text-sm">Direct Peer-to-Peer Bank Settlement</div>
                    <p className="leading-relaxed text-emerald-800">
                      When a customer confirms a print order at your counter, the dynamic QR initiates an instant peer-to-peer UPI transfer straight into your bank.
                      <strong> Printap takes zero commission and holds zero funds.</strong>
                    </p>
                  </div>
                </div>

                {/* Comprehensive Onboarding Review Card */}
                <div className="bg-zinc-50/80 border border-zinc-200 rounded-2xl p-4 text-xs space-y-3">
                  <div className="font-bold text-zinc-700 uppercase tracking-wider text-[11px] flex items-center justify-between">
                    <span>Summary Review</span>
                    <span className="text-indigo-600 font-semibold">Ready for verification</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-zinc-600 font-medium pt-1">
                    <div>Shop: <span className="font-bold text-zinc-900 block truncate">{shopName}</span></div>
                    <div>Subdomain: <span className="font-mono font-bold text-indigo-600 block truncate">{slug}.mellod.in</span></div>
                    <div>Owner: <span className="font-bold text-zinc-900 block truncate">{ownerName}</span></div>
                    <div>Login Email: <span className="font-bold text-zinc-900 block truncate">{ownerEmail}</span></div>
                    <div className="col-span-2">
                      Address: <span className="text-zinc-900 block truncate">{address || `${city || ""} ${state || ""}` || "Coordinates pinned on map"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
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
                    disabled={isSendingOtp}
                    className="flex-1 py-3.5 px-6 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2"
                  >
                    {isSendingOtp ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span>Dispatching Verification Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify Email & Complete Registration</span>
                        <span>→</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 4: 6-DIGIT EMAIL OTP VERIFICATION */}
            {currentStep === 4 && (
              <div className="glass-strong rounded-3xl p-6 sm:p-8 border border-zinc-200 shadow-sm space-y-6 animate-fadeIn">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-black text-zinc-900">Verify Your Owner Email</h3>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                    We sent a 6-digit confirmation code via Resend to:
                    <br />
                    <strong className="text-zinc-900 text-sm font-semibold">{ownerEmail}</strong>
                  </p>
                </div>

                {otpError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold text-center animate-shake">
                    {otpError}
                  </div>
                )}

                {/* 6 Digit Input Boxes */}
                <div className="flex justify-center gap-2 sm:gap-3 py-2">
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-digit-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-extrabold text-zinc-900 bg-white border-2 border-zinc-300 rounded-xl focus:border-indigo-600 focus:outline-none transition-colors shadow-sm"
                    />
                  ))}
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={handleConfirmOtp}
                    disabled={otpSubmitting || otpDigits.join("").length !== 6}
                    className="w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 text-white font-extrabold text-base rounded-2xl shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {otpSubmitting ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span>Launching Storefront...</span>
                      </>
                    ) : (
                      <span>Confirm & Launch Shop 🚀</span>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-xs pt-1 px-1">
                    <button
                      type="button"
                      onClick={() => {
                        setStepError(null);
                        setCurrentStep(3);
                      }}
                      className="text-zinc-500 hover:text-zinc-700 font-medium"
                    >
                      ← Edit Information
                    </button>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resendCooldown > 0 || otpSubmitting}
                      className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50 font-bold"
                    >
                      {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend Code"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: LIVE STORE PREVIEW CARD (Updates dynamically as user inputs data) */}
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
                {/* Browser Address Bar */}
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

                {/* Mock Content */}
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

                  {/* Badges */}
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

                  {/* Customer Upload Placeholder */}
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
                  <div>User: <span className="text-zinc-900 font-semibold">{ownerEmail || "owner@email.com"}</span></div>
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

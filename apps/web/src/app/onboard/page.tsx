"use client";

import React, { useState, useEffect, useCallback, useId } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { sanitizeSubdomain } from "@printap/shared";

// Dynamically import MapLocationPicker with SSR disabled (Leaflet requires browser window)
const MapLocationPicker = dynamic(
  () =>
    import("@/components/onboard/MapLocationPicker").then(
      (mod) => mod.MapLocationPicker
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[320px] rounded-2xl bg-zinc-100 flex items-center justify-center text-xs text-zinc-500 font-medium animate-pulse border border-zinc-200">
        Loading Interactive Map...
      </div>
    ),
  }
);

interface SlugCheckState {
  checking: boolean;
  available: boolean | null;
  sanitized: string;
  reason?: string;
}

export default function OnboardPage() {
  // Form fields
  const [shopName, setShopName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [upiVpa, setUpiVpa] = useState("");

  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Geolocation fields
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  // Subdomain validation state
  const [slugState, setSlugState] = useState<SlugCheckState>({
    checking: false,
    available: null,
    sanitized: "",
  });

  // Flow & Modal state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Registration success state
  const [registeredShop, setRegisteredShop] = useState<{
    name: string;
    slug: string;
    owner_email: string;
  } | null>(null);

  // Unique IDs for accessibility
  const shopNameId = useId();
  const slugId = useId();
  const upiId = useId();
  const ownerNameId = useId();
  const ownerPhoneId = useId();
  const ownerEmailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const addressId = useId();
  const cityId = useId();
  const stateId = useId();
  const pincodeId = useId();

  // Auto-generate slug from shop name unless manually edited
  useEffect(() => {
    if (!isSlugManuallyEdited && shopName) {
      setSlug(sanitizeSubdomain(shopName));
    }
  }, [shopName, isSlugManuallyEdited]);

  // Debounced check-slug API call
  useEffect(() => {
    const target = slug.trim();
    if (!target || target.length < 2) {
      setSlugState({ checking: false, available: null, sanitized: target });
      return;
    }

    setSlugState((prev) => ({ ...prev, checking: true }));
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-slug?slug=${encodeURIComponent(target)}`);
        const data = await res.json();
        setSlugState({
          checking: false,
          available: data.available,
          sanitized: data.sanitizedSlug || target,
          reason: data.reason,
        });
      } catch {
        setSlugState({ checking: false, available: null, sanitized: target });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [slug]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
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

  // Validate form fields before sending OTP
  const validateForm = (): string | null => {
    if (!shopName.trim()) return "Please enter your shop name.";
    if (!slug.trim()) return "Please enter your desired store subdomain.";
    if (slugState.available === false) return slugState.reason || "Please select an available subdomain.";
    if (!upiVpa.trim() || !upiVpa.includes("@"))
      return "Please enter a valid UPI VPA ID (e.g. name@okaxis) to receive payments.";
    if (!ownerName.trim()) return "Please enter the owner's full name.";
    if (!ownerEmail.trim() || !ownerEmail.includes("@"))
      return "Please enter a valid owner email address.";
    if (password.length < 8) return "Password must be at least 8 characters long.";
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password))
      return "Password must contain at least one uppercase letter and one number.";
    if (password !== confirmPassword) return "Passwords do not match.";
    if (latitude === null || longitude === null)
      return "Please pinpoint your shop location on the map.";
    return null;
  };

  // Trigger Send OTP
  const handleInitiateRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const error = validateForm();
    if (error) {
      setErrorMessage(error);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);
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
        setErrorMessage(data.error || "Failed to send verification code. Please try again.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        setIsSubmitting(false);
        return;
      }

      setResendCooldown(60);
      setShowOtpModal(true);
      setOtpError(null);
      setOtpDigits(["", "", "", "", "", ""]);
    } catch (err) {
      setErrorMessage("Network error while requesting verification code.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
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

    // Support pasting multi-digit code
    if (clean.length > 1) {
      const pasteDigits = clean.slice(0, 6).split("");
      const next = [...otpDigits];
      pasteDigits.forEach((digit, i) => {
        if (i < 6) next[i] = digit;
      });
      setOtpDigits(next);
      const nextFocus = Math.min(pasteDigits.length, 5);
      const elem = document.getElementById(`otp-input-${nextFocus}`);
      elem?.focus();
      return;
    }

    const next = [...otpDigits];
    next[index] = clean.slice(-1);
    setOtpDigits(next);

    // Auto-advance to next box
    if (index < 5 && clean) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
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
        setOtpError(data.error || "Failed to complete registration.");
        setOtpSubmitting(false);
        return;
      }

      setShowOtpModal(false);
      setRegisteredShop(data.shop);
    } catch (err) {
      setOtpError("Network error during registration.");
      console.error(err);
    } finally {
      setOtpSubmitting(false);
    }
  };

  // Resend OTP from within modal
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

  // Render Registration Success Screen
  if (registeredShop) {
    const storefrontUrl = `https://${registeredShop.slug}.mellod.in`;
    return (
      <div className="min-h-screen bg-mesh py-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-xl w-full glass-strong rounded-3xl p-8 sm:p-10 border border-zinc-200 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div>
            <div className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full mb-3 tracking-wide">
              SHOP ONBOARDED SUCCESSFULLY
            </div>
            <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">
              {registeredShop.name} is Live!
            </h1>
            <p className="text-sm text-zinc-600 mt-2">
              Your store has been created and your unique subdomain is ready to accept print orders.
            </p>
          </div>

          {/* Subdomain URL Card */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-left space-y-2">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Customer Storefront URL
            </div>
            <div className="flex items-center justify-between gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-zinc-200">
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
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-5 text-left space-y-3">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>Connect Your Counter Terminal</span>
            </div>
            <p className="text-xs text-indigo-800/80 leading-relaxed">
              Launch the <strong>Printap Counter Desktop Agent</strong> on your shop PC and sign in using your registered email:
            </p>
            <div className="bg-white p-3 rounded-xl border border-indigo-200 text-xs space-y-1 font-mono">
              <div><strong className="text-zinc-600">Login Email:</strong> <span className="text-zinc-900">{registeredShop.owner_email}</span></div>
              <div><strong className="text-zinc-600">Shop Handle:</strong> <span className="text-zinc-900">{registeredShop.slug}</span></div>
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
    <div className="min-h-screen bg-mesh py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-2 group">
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
          <p className="text-sm text-zinc-600 max-w-md mx-auto">
            Get your own branded subdomain, receive direct UPI payments, and manage instant customer print queues.
          </p>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex items-center gap-3 shadow-sm animate-shake">
            <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleInitiateRegistration} className="space-y-8">
          {/* SECTION 1: SHOP IDENTITY */}
          <div className="glass-strong rounded-3xl p-6 sm:p-8 border border-zinc-200 shadow-sm space-y-6">
            <div className="border-b border-zinc-100 pb-4">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                Step 1 of 3
              </span>
              <h2 className="text-xl font-extrabold text-zinc-900">Shop Identity & Subdomain</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Shop Name */}
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor={shopNameId} className="block text-xs font-bold text-zinc-700">
                  Shop Name <span className="text-red-500">*</span>
                </label>
                <input
                  id={shopNameId}
                  type="text"
                  required
                  placeholder="e.g. Apex Digital Print & Xerox"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-900 font-medium placeholder:text-zinc-400"
                />
              </div>

              {/* Subdomain Slug */}
              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label htmlFor={slugId} className="block text-xs font-bold text-zinc-700">
                    Storefront Subdomain <span className="text-red-500">*</span>
                  </label>
                  {slugState.checking ? (
                    <span className="text-[11px] text-zinc-400 font-medium">Checking availability...</span>
                  ) : slugState.available === true ? (
                    <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                      ✓ Available
                    </span>
                  ) : slugState.available === false ? (
                    <span className="text-[11px] text-red-500 font-bold">{slugState.reason}</span>
                  ) : null}
                </div>

                <div className="flex items-center rounded-xl border border-zinc-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                  <input
                    id={slugId}
                    type="text"
                    required
                    placeholder="my-shop"
                    value={slug}
                    onChange={(e) => {
                      setIsSlugManuallyEdited(true);
                      setSlug(sanitizeSubdomain(e.target.value));
                    }}
                    className="flex-1 px-4 py-2.5 text-sm bg-transparent border-0 focus:outline-none text-zinc-900 font-mono font-bold"
                  />
                  <div className="px-4 py-2.5 bg-zinc-100 border-l border-zinc-200 text-xs font-mono font-semibold text-zinc-600 shrink-0">
                    .mellod.in
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Customers will visit{" "}
                  <code className="text-indigo-600 font-bold">
                    https://{slug || "your-shop"}.mellod.in
                  </code>{" "}
                  to send print jobs directly.
                </p>
              </div>

              {/* UPI ID */}
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor={upiId} className="block text-xs font-bold text-zinc-700">
                  Owner UPI VPA ID <span className="text-red-500">*</span>
                </label>
                <input
                  id={upiId}
                  type="text"
                  required
                  placeholder="e.g. apexprints@okaxis, shop@okhdfcbank"
                  value={upiVpa}
                  onChange={(e) => setUpiVpa(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-900 font-mono placeholder:text-zinc-400"
                />
                <p className="text-[11px] text-zinc-500">
                  100% of customer print payments are deposited directly into this UPI ID.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 2: OWNER CREDENTIALS */}
          <div className="glass-strong rounded-3xl p-6 sm:p-8 border border-zinc-200 shadow-sm space-y-6">
            <div className="border-b border-zinc-100 pb-4">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                Step 2 of 3
              </span>
              <h2 className="text-xl font-extrabold text-zinc-900">Owner Profile & Terminal Login</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                  className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-900 font-medium placeholder:text-zinc-400"
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
                  className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-900 font-medium placeholder:text-zinc-400"
                />
              </div>

              {/* Owner Email (Primary Login) */}
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor={ownerEmailId} className="block text-xs font-bold text-zinc-700">
                  Primary Login Email <span className="text-red-500">*</span>
                </label>
                <input
                  id={ownerEmailId}
                  type="email"
                  required
                  placeholder="e.g. rahul@apexprints.com"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-900 font-medium placeholder:text-zinc-400"
                />
                <p className="text-[11px] text-zinc-500">
                  This will be your terminal username. A 6-digit verification code will be sent to this email.
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
                  className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-900 font-medium placeholder:text-zinc-400"
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
                  className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-900 font-medium placeholder:text-zinc-400"
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
          </div>

          {/* SECTION 3: STORE GEOLOCATION & MAP PIN */}
          <div className="glass-strong rounded-3xl p-6 sm:p-8 border border-zinc-200 shadow-sm space-y-6">
            <div className="border-b border-zinc-100 pb-4">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                Step 3 of 3
              </span>
              <h2 className="text-xl font-extrabold text-zinc-900">Store Geolocation & Address</h2>
              <p className="text-xs text-zinc-500 mt-1">
                Pinpoint your store on the map so nearby customers can locate your counter.
              </p>
            </div>

            {/* Interactive Leaflet Map */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-700">
                Pinpoint Shop Location on Map <span className="text-red-500">*</span>
              </label>
              <MapLocationPicker
                latitude={latitude}
                longitude={longitude}
                onChange={handleLocationChange}
              />
            </div>

            {/* Address fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="sm:col-span-3 space-y-1.5">
                <label htmlFor={addressId} className="block text-xs font-bold text-zinc-700">
                  Street Address / Landmark
                </label>
                <input
                  id={addressId}
                  type="text"
                  placeholder="e.g. Shop #4, Ground Floor, Near Metro Station"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-2 text-sm bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-zinc-900 placeholder:text-zinc-400"
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
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 text-white font-extrabold text-base rounded-2xl shadow-xl shadow-indigo-600/25 transition-all transform active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Sending Verification Code...</span>
                </>
              ) : (
                <>
                  <span>Verify Email & Create Shop</span>
                  <span className="text-indigo-200">→</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* MODAL: 6-DIGIT RESEND EMAIL OTP VERIFICATION */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-zinc-200 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-black text-zinc-900">Verify Your Email</h3>
              <p className="text-xs text-zinc-500">
                We sent a 6-digit verification code to:
                <br />
                <strong className="text-zinc-900 font-semibold">{ownerEmail}</strong>
              </p>
            </div>

            {otpError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold text-center">
                {otpError}
              </div>
            )}

            {/* 6 Digit Input Boxes */}
            <div className="flex justify-center gap-2 sm:gap-3">
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-input-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-extrabold text-zinc-900 bg-zinc-50 border-2 border-zinc-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none transition-colors"
                />
              ))}
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleConfirmOtp}
                disabled={otpSubmitting || otpDigits.join("").length !== 6}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
              >
                {otpSubmitting ? "Verifying..." : "Confirm & Launch Shop"}
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="text-zinc-500 hover:text-zinc-700 font-medium"
                >
                  Cancel
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
        </div>
      )}
    </div>
  );
}

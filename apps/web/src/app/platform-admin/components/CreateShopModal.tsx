"use client";

import React, { useState } from "react";
import { ROOT_DOMAIN, sanitizeSubdomain, getSupabase } from "@printap/shared";
import { CloseIcon, PlusIcon } from "./AdminIcons";

interface CreateShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShopCreated: () => void;
}

export function CreateShopModal({
  isOpen,
  onClose,
  onShopCreated,
}: CreateShopModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [upi, setUpi] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === sanitizeSubdomain(name)) {
      setSlug(sanitizeSubdomain(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !upi.trim()) {
      setError("Shop name and UPI VPA are required.");
      return;
    }

    const cleanSlug = sanitizeSubdomain(slug || name);
    setIsSubmitting(true);

    try {
      const supabase = getSupabase();

      // Check slug uniqueness
      const { data: existing } = await supabase
        .from("shops")
        .select("id")
        .eq("slug", cleanSlug)
        .maybeSingle();

      if (existing) {
        setError(`Subdomain slug "${cleanSlug}.${ROOT_DOMAIN}" is already taken.`);
        setIsSubmitting(false);
        return;
      }

      const { error: insertErr } = await supabase.from("shops").insert({
        name: name.trim(),
        slug: cleanSlug,
        upi_vpa: upi.trim(),
        status: "active",
      });

      if (insertErr) throw insertErr;

      setName("");
      setSlug("");
      setUpi("");
      onClose();
      onShopCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative glass-strong rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl z-10 border border-white/80 animate-fade-in-up">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-[--color-foreground]">
            Register New Shop Terminal
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-[--color-muted] hover:text-black hover:bg-black/5 transition"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[--color-muted] mb-5">
          Deploys an instant dedicated subdomain under {ROOT_DOMAIN} with WebRTC signaling.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[--color-foreground] mb-1">
              Shop Name
            </label>
            <input
              type="text"
              placeholder="e.g. Rahul Xerox & Printing"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-xs text-[--color-foreground] focus:outline-none focus:border-black shadow-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[--color-foreground] mb-1">
              Subdomain Slug
            </label>
            <div className="flex items-center rounded-xl bg-white border border-black/10 px-3 shadow-sm focus-within:border-black">
              <input
                type="text"
                placeholder="rahul-xerox"
                value={slug}
                onChange={(e) => setSlug(sanitizeSubdomain(e.target.value))}
                className="flex-1 py-2.5 bg-transparent text-xs text-[--color-foreground] font-mono outline-none"
                required
              />
              <span className="text-xs text-[--color-muted] font-mono">.{ROOT_DOMAIN}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[--color-foreground] mb-1">
              Settlement UPI VPA
            </label>
            <input
              type="text"
              placeholder="e.g. rahul@okaxis or 9876543210@paytm"
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-xs text-[--color-foreground] font-mono focus:outline-none focus:border-black shadow-sm"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 font-medium">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[--color-muted] hover:text-[--color-foreground]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-md flex items-center gap-1.5"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Deploying..." : "Create Terminal"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

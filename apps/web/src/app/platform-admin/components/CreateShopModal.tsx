"use client";

import React, { useState } from "react";
import { ROOT_DOMAIN, sanitizeSubdomain, getSupabase } from "@printap/shared";
import { IconClose } from "./Icons";

interface CreateShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateShopModal({ isOpen, onClose, onSuccess }: CreateShopModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [upi, setUpi] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      setError("Shop Name and Settlement UPI VPA are required.");
      return;
    }

    const cleanSlug = sanitizeSubdomain(slug || name);
    setSubmitting(true);

    try {
      const supabase = getSupabase();

      // Check if slug taken
      const { data: existing } = await supabase
        .from("shops")
        .select("id")
        .eq("slug", cleanSlug)
        .maybeSingle();

      if (existing) {
        setError(`Subdomain slug "${cleanSlug}.${ROOT_DOMAIN}" is already taken.`);
        setSubmitting(false);
        return;
      }

      const { error: insertErr } = await supabase
        .from("shops")
        .insert({
          name: name.trim(),
          slug: cleanSlug,
          upi_vpa: upi.trim(),
          status: "active",
        });

      if (insertErr) throw insertErr;

      setName("");
      setSlug("");
      setUpi("");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="wabi-bento-card rounded-3xl p-7 max-w-md w-full shadow-2xl animate-fade-in-up border border-zinc-200 bg-white relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
              新規 • NEW
            </span>
            <h2 className="text-base font-bold text-black">
              Register New Shop Terminal
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-black hover:bg-zinc-100"
          >
            <IconClose size={16} />
          </button>
        </div>

        <p className="text-xs text-zinc-500 mb-5">
          Provisions an instant dedicated subdomain under {ROOT_DOMAIN} with WebRTC signaling.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-black mb-1.5">
              Shop Name
            </label>
            <input
              type="text"
              placeholder="e.g. Campus Xerox & Prints"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-black placeholder-zinc-400 focus:outline-none focus:border-black"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-black mb-1.5">
              Subdomain Slug
            </label>
            <div className="flex items-center rounded-xl bg-zinc-50 border border-zinc-200 px-3 focus-within:border-black">
              <input
                type="text"
                placeholder="campus-xerox"
                value={slug}
                onChange={(e) => setSlug(sanitizeSubdomain(e.target.value))}
                className="flex-1 py-2.5 bg-transparent text-xs text-black font-mono outline-none"
                required
              />
              <span className="text-xs text-zinc-400 font-mono">.{ROOT_DOMAIN}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-black mb-1.5">
              Settlement UPI VPA
            </label>
            <input
              type="text"
              placeholder="e.g. storename@okaxis or 9876543210@paytm"
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-black placeholder-zinc-400 focus:outline-none focus:border-black"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-zinc-100 border border-zinc-300 text-xs text-black">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-zinc-600 hover:text-black"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="wabi-btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>{submitting ? "Deploying..." : "Create & Deploy Terminal"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

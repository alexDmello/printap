"use client";

import React, { useState, useEffect } from "react";
import { ROOT_DOMAIN, sanitizeSubdomain, getSupabase } from "@printap/shared";
import { CloseIcon } from "./AdminIcons";
import type { ExtendedShop } from "./BentoOverview";

interface EditShopModalProps {
  shop: ExtendedShop | null;
  onClose: () => void;
  onShopUpdated: () => void;
  globalPlatformFee: number;
  globalGstPercentage: number;
}

export function EditShopModal({
  shop,
  onClose,
  onShopUpdated,
  globalPlatformFee,
  globalGstPercentage,
}: EditShopModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [upi, setUpi] = useState("");
  const [fee, setFee] = useState<number>(0.82);
  const [gstPct, setGstPct] = useState<number>(18);
  const [gstAmt, setGstAmt] = useState<number>(0.18);
  const [totalCharge, setTotalCharge] = useState<number>(1.0);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (shop) {
      setName(shop.name);
      setSlug(shop.slug || sanitizeSubdomain(shop.name));
      setUpi(shop.upi_vpa);
      const pf =
        shop.platform_fee !== undefined && shop.platform_fee !== null
          ? Number(shop.platform_fee)
          : globalPlatformFee;
      const gp =
        shop.gst_percentage !== undefined && shop.gst_percentage !== null
          ? Number(shop.gst_percentage)
          : globalGstPercentage;
      const ga =
        shop.gst_amount !== undefined && shop.gst_amount !== null
          ? Number(shop.gst_amount)
          : Math.round(pf * (gp / 100) * 100) / 100;
      const tc =
        shop.total_charge !== undefined && shop.total_charge !== null
          ? Number(shop.total_charge)
          : Math.round((pf + ga) * 100) / 100;

      setFee(pf);
      setGstPct(gp);
      setGstAmt(ga);
      setTotalCharge(tc);
      setError("");
    }
  }, [shop, globalPlatformFee, globalGstPercentage]);

  if (!shop) return null;

  const handleFeeChange = (val: number) => {
    const f = Math.max(0, Number(val) || 0);
    setFee(f);
    const g = Math.round(f * (gstPct / 100) * 100) / 100;
    setGstAmt(g);
    setTotalCharge(Math.round((f + g) * 100) / 100);
  };

  const handleGstChange = (val: number) => {
    const p = Math.max(0, Math.min(100, Number(val) || 0));
    setGstPct(p);
    const g = Math.round(fee * (p / 100) * 100) / 100;
    setGstAmt(g);
    setTotalCharge(Math.round((fee + g) * 100) / 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanSlug = sanitizeSubdomain(slug);
    setIsSubmitting(true);

    try {
      const supabase = getSupabase();
      const { error: updateErr } = await supabase
        .from("shops")
        .update({
          name: name.trim(),
          slug: cleanSlug,
          upi_vpa: upi.trim(),
          platform_fee: fee,
          gst_percentage: gstPct,
          gst_amount: gstAmt,
          total_charge: totalCharge,
        })
        .eq("id", shop.id);

      if (updateErr) throw updateErr;

      onClose();
      onShopUpdated();
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
          <h2 className="text-lg font-bold text-[--color-foreground]">Edit Shop Terminal</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-[--color-muted] hover:text-black hover:bg-black/5 transition"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="text-[10px] font-mono text-[--color-muted] mb-5 truncate">
          UUID: {shop.id}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[--color-foreground] mb-1">
              Shop Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-xs text-[--color-foreground] font-mono focus:outline-none focus:border-black shadow-sm"
              required
            />
          </div>

          {/* Surcharge Config Bento in modal */}
          <div className="p-3.5 rounded-2xl bg-black/[0.03] border border-black/[0.06] space-y-3">
            <div className="text-xs font-bold text-[--color-foreground] flex items-center justify-between">
              <span>Platform Fee & Tax Override</span>
              <span className="text-[11px] text-emerald-600 font-mono font-bold">
                Total: ₹{totalCharge.toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-[--color-muted] mb-1">Base Fee (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fee}
                  onChange={(e) => handleFeeChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white border border-black/10 text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[--color-muted] mb-1">GST (%)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={gstPct}
                  onChange={(e) => handleGstChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white border border-black/10 text-xs font-mono font-bold text-center"
                />
              </div>
            </div>

            <div className="text-[10px] text-[--color-muted] flex justify-between pt-1 border-t border-black/[0.04]">
              <span>Auto Tax: ₹{gstAmt.toFixed(2)}</span>
              <span>Customer Pays: ₹{totalCharge.toFixed(2)}</span>
            </div>
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
              className="btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-md"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

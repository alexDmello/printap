"use client";

import React, { useState, useEffect } from "react";
import { ROOT_DOMAIN, sanitizeSubdomain, getSupabase } from "@printap/shared";
import type { ExtendedShop } from "../types";
import { IconClose } from "./Icons";

interface EditShopModalProps {
  shop: ExtendedShop | null;
  onClose: () => void;
  onSuccess: () => void;
  globalPlatformFee: number;
  globalGstPercentage: number;
}

export function EditShopModal({
  shop,
  onClose,
  onSuccess,
  globalPlatformFee,
  globalGstPercentage,
}: EditShopModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [upi, setUpi] = useState("");
  const [fee, setFee] = useState<number>(0.82);
  const [gstPct, setGstPct] = useState<number>(18);
  const [gstAmount, setGstAmount] = useState<number>(0.18);
  const [totalCharge, setTotalCharge] = useState<number>(1.0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (shop) {
      setName(shop.name || "");
      setSlug(shop.slug || sanitizeSubdomain(shop.name));
      setUpi(shop.upi_vpa || "");

      const pf = shop.platform_fee !== undefined && shop.platform_fee !== null ? Number(shop.platform_fee) : globalPlatformFee;
      const gp = shop.gst_percentage !== undefined && shop.gst_percentage !== null ? Number(shop.gst_percentage) : globalGstPercentage;
      const ga = shop.gst_amount !== undefined && shop.gst_amount !== null ? Number(shop.gst_amount) : Math.round(pf * (gp / 100) * 100) / 100;
      const tc = shop.total_charge !== undefined && shop.total_charge !== null ? Number(shop.total_charge) : Math.round((pf + ga) * 100) / 100;

      setFee(pf);
      setGstPct(gp);
      setGstAmount(ga);
      setTotalCharge(tc);
      setError("");
    }
  }, [shop, globalPlatformFee, globalGstPercentage]);

  if (!shop) return null;

  const handleFeeChange = (val: number) => {
    const f = Math.max(0, Number(val) || 0);
    setFee(f);
    const gst = Math.round(f * (gstPct / 100) * 100) / 100;
    setGstAmount(gst);
    setTotalCharge(Math.round((f + gst) * 100) / 100);
  };

  const handleGstChange = (val: number) => {
    const pct = Math.max(0, Math.min(100, Number(val) || 0));
    setGstPct(pct);
    const gst = Math.round(fee * (pct / 100) * 100) / 100;
    setGstAmount(gst);
    setTotalCharge(Math.round((fee + gst) * 100) / 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    const cleanSlug = sanitizeSubdomain(slug);

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
          gst_amount: gstAmount,
          total_charge: totalCharge,
        })
        .eq("id", shop.id);

      if (updateErr) throw updateErr;

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="wabi-bento-card rounded-3xl p-7 max-w-md w-full shadow-2xl animate-fade-in-up border border-[#2a2a2e] bg-[#121214] relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
              編集 • EDIT
            </span>
            <h2 className="text-base font-bold text-white">
              Edit Terminal Configuration
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <IconClose size={16} />
          </button>
        </div>

        <p className="text-[11px] font-mono text-zinc-400 mb-5 truncate">
          Terminal UUID: {shop.id}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">
              Shop Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#2a2a2e] text-xs text-white focus:outline-none focus:border-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">
              Subdomain Slug
            </label>
            <div className="flex items-center rounded-xl bg-[#18181b] border border-[#2a2a2e] px-3 focus-within:border-white">
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(sanitizeSubdomain(e.target.value))}
                className="flex-1 py-2.5 bg-transparent text-xs text-white font-mono outline-none"
                required
              />
              <span className="text-xs text-zinc-400 font-mono">.{ROOT_DOMAIN}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">
              Settlement UPI VPA
            </label>
            <input
              type="text"
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#2a2a2e] text-xs text-white focus:outline-none focus:border-white"
              required
            />
          </div>

          {/* Surcharge Override Box */}
          <div className="p-4 rounded-2xl bg-[#18181b] border border-[#27272a] space-y-3">
            <div className="text-xs font-bold text-white flex items-center justify-between">
              <span>Terminal Surcharge Override</span>
              <span className="text-[11px] text-white font-mono font-bold">
                Total: ₹{totalCharge.toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">
                  Base Fee (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fee}
                  onChange={(e) => handleFeeChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#202024] border border-[#2d2d32] text-xs font-mono font-bold text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">
                  GST (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={gstPct}
                  onChange={(e) => handleGstChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#202024] border border-[#2d2d32] text-xs font-mono font-bold text-white text-center"
                />
              </div>
            </div>

            <div className="text-[10px] text-zinc-400 flex justify-between pt-1 border-t border-[#27272a]">
              <span>Auto-GST: ₹{gstAmount.toFixed(2)}</span>
              <span>Customer Surcharge: ₹{totalCharge.toFixed(2)}</span>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-zinc-800 border border-zinc-700 text-xs text-zinc-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1f1f23]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="wabi-btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>{saving ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

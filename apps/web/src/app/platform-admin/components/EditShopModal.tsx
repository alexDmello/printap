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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="wabi-bento-card rounded-3xl p-7 max-w-md w-full shadow-2xl animate-fade-in-up border border-[#383227] bg-[#1c1a16] relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
              編集 • EDIT
            </span>
            <h2 className="text-base font-bold text-[#f4ede4]">
              Edit Terminal Configuration
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#8a8174] hover:text-[#f4ede4] hover:bg-[#25221b]"
          >
            <IconClose size={16} />
          </button>
        </div>

        <p className="text-[11px] font-mono text-[#736a5c] mb-5 truncate">
          Terminal UUID: {shop.id}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#f4ede4] mb-1.5">
              Shop Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#23201a] border border-[#383227] text-xs text-[#f4ede4] focus:outline-none focus:border-[#c59e5e]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f4ede4] mb-1.5">
              Subdomain Slug
            </label>
            <div className="flex items-center rounded-xl bg-[#23201a] border border-[#383227] px-3 focus-within:border-[#c59e5e]">
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(sanitizeSubdomain(e.target.value))}
                className="flex-1 py-2.5 bg-transparent text-xs text-[#f4ede4] font-mono outline-none"
                required
              />
              <span className="text-xs text-[#736a5c] font-mono">.{ROOT_DOMAIN}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#f4ede4] mb-1.5">
              Settlement UPI VPA
            </label>
            <input
              type="text"
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#23201a] border border-[#383227] text-xs text-[#f4ede4] focus:outline-none focus:border-[#c59e5e]"
              required
            />
          </div>

          {/* Surcharge Override Box */}
          <div className="p-4 rounded-2xl bg-[#201d17] border border-[#2d2922] space-y-3">
            <div className="text-xs font-bold text-[#f4ede4] flex items-center justify-between">
              <span>Terminal Surcharge Override</span>
              <span className="text-[11px] text-[#528364] font-mono font-bold">
                Total: ₹{totalCharge.toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-[#8a8174] mb-1">
                  Base Fee (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fee}
                  onChange={(e) => handleFeeChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#27231c] border border-[#383227] text-xs font-mono font-bold text-[#f4ede4]"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[#8a8174] mb-1">
                  GST (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={gstPct}
                  onChange={(e) => handleGstChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#27231c] border border-[#383227] text-xs font-mono font-bold text-[#f4ede4] text-center"
                />
              </div>
            </div>

            <div className="text-[10px] text-[#736a5c] flex justify-between pt-1 border-t border-[#2d2922]">
              <span>Auto-GST: ₹{gstAmount.toFixed(2)}</span>
              <span>Customer Surcharge: ₹{totalCharge.toFixed(2)}</span>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-[#d96548]/15 border border-[#d96548]/30 text-xs text-[#e57c60]">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#26221c]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-[#8a8174] hover:text-[#f4ede4]"
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

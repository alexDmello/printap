import React, { useState } from "react";
import { ROOT_DOMAIN } from "@printap/shared";
import type { ExtendedShop } from "../types";
import { IconClose, IconTrash } from "./Icons";

const ADMIN_SECRET = import.meta.env.VITE_PRINTAP_ADMIN_SECRET || "";

/** Base URL where the Next.js web app is hosted.
 *  In dev (Electron localhost), we target the local Next.js dev server.
 *  In production, we target the deployed domain. */
const WEB_API_BASE = (() => {
  // Check if running in dev mode (Electron loads from localhost or Vite dev server)
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.protocol === "file:")
  ) {
    return "http://localhost:3000";
  }
  return `https://www.${ROOT_DOMAIN}`;
})();

interface DeleteShopModalProps {
  shop: ExtendedShop | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteShopModal({ shop, onClose, onSuccess }: DeleteShopModalProps) {
  const [confirmName, setConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!shop) return null;

  const shopSlug = shop.slug || shop.id.slice(0, 8);
  const ownerEmail = shop.owner_email || "";
  const nameMatches = confirmName.trim().toLowerCase() === shop.name.trim().toLowerCase();

  const handleDelete = async () => {
    if (!nameMatches) {
      setError(`Please type "${shop.name}" exactly to confirm deletion.`);
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      // Call the server-side API route which has service_role access
      const res = await fetch(`${WEB_API_BASE}/api/admin/offboard-shop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: shop.id,
          admin_secret: ADMIN_SECRET,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.error || `Server returned ${res.status}. Please check the web app is running.`
        );
      }

      console.log("[DeleteShop] Successfully offboarded shop:", data);
      onSuccess();
      onClose();
    } catch (err) {
      console.error("[DeleteShop] Failed to offboard shop:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-zinc-200 shadow-2xl p-6 sm:p-7 relative overflow-hidden">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isDeleting}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-zinc-400 hover:text-black hover:bg-zinc-100 transition"
        >
          <IconClose size={18} />
        </button>

        {/* Header with Danger Beacon */}
        <div className="flex items-start gap-3.5 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
            <IconTrash size={20} />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 mb-1">
              Danger Zone • Permanent Offboarding
            </div>
            <h3 className="text-lg font-black text-zinc-950 tracking-tight leading-snug">
              Delete & Offboard Shop Account
            </h3>
          </div>
        </div>

        {/* Shop Info Card */}
        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2 mb-4 text-xs font-mono">
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 font-sans">Shop Name:</span>
            <span className="font-bold text-zinc-950">{shop.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 font-sans">Subdomain URL:</span>
            <span className="text-zinc-700">{shopSlug}.{ROOT_DOMAIN}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 font-sans">Owner Email / Google:</span>
            <span className="font-bold text-zinc-900 bg-white px-2 py-0.5 rounded border border-zinc-200">
              {ownerEmail || "No email linked"}
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-zinc-400 pt-1 border-t border-zinc-200">
            <span>UUID:</span>
            <span className="truncate max-w-[240px]">{shop.id}</span>
          </div>
        </div>

        {/* Warning Bullet Points */}
        <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200/80 mb-5 space-y-2 text-xs text-rose-900">
          <p className="font-bold flex items-center gap-1.5 text-rose-950">
            <span>⚠️</span> This action is completely permanent and cannot be undone:
          </p>
          <ul className="space-y-1.5 list-disc list-inside text-[11px] text-rose-800 pl-1 leading-relaxed">
            <li>
              <strong>Google OAuth & Credentials:</strong> Owner account ({ownerEmail || "linked email"}) is purged from authentication records as if they never onboarded.
            </li>
            <li>
              <strong>Subdomain Released:</strong> The web handle <code>{shopSlug}.{ROOT_DOMAIN}</code> will be immediately released.
            </li>
            <li>
              <strong>Orders & Logs:</strong> All print events, order history, and verification OTPs will be erased.
            </li>
          </ul>
        </div>

        {/* Confirmation Input */}
        <div className="space-y-2 mb-5">
          <label className="block text-xs font-semibold text-zinc-700">
            To confirm, type <span className="font-black text-black select-all">"{shop.name}"</span> below:
          </label>
          <input
            type="text"
            value={confirmName}
            onChange={(e) => {
              setConfirmName(e.target.value);
              setError(null);
            }}
            placeholder={`Type "${shop.name}" to confirm`}
            disabled={isDeleting}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-xs text-black placeholder-zinc-400 focus:outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-600 font-sans transition"
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 text-xs mb-4">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:text-black hover:bg-zinc-100 transition disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={!nameMatches || isDeleting}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:hover:bg-rose-600 transition shadow-sm flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Purging Shop & Auth...</span>
              </>
            ) : (
              <>
                <IconTrash size={13} />
                <span>Permanently Offboard & Wipe</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { ROOT_DOMAIN, sanitizeSubdomain, isReservedSubdomain, getSupabase } from "@printap/shared";
import type { ExtendedShop } from "../types";
import { IconClose, IconTrash } from "./Icons";

interface EditShopModalProps {
  shop: ExtendedShop | null;
  onClose: () => void;
  onSuccess: () => void;
  onOpenDeleteModal?: (shop: ExtendedShop) => void;
}

export function EditShopModal({
  shop,
  onClose,
  onSuccess,
  onOpenDeleteModal,
}: EditShopModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [upi, setUpi] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (shop) {
      setName(shop.name || "");
      setSlug(shop.slug || sanitizeSubdomain(shop.name));
      setUpi(shop.upi_vpa || "");
      setError("");
    }
  }, [shop]);

  if (!shop) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    const cleanSlug = sanitizeSubdomain(slug);

    if (isReservedSubdomain(cleanSlug)) {
      setError(`Subdomain slug "${cleanSlug}" is reserved (e.g. admin, shop, api) and cannot be assigned to a shop.`);
      setSaving(false);
      return;
    }

    try {
      const supabase = getSupabase();
      const { error: updateErr } = await supabase
        .from("shops")
        .update({
          name: name.trim(),
          slug: cleanSlug,
          upi_vpa: upi.trim(),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="wabi-bento-card rounded-3xl p-7 max-w-md w-full shadow-2xl animate-fade-in-up border border-zinc-200 bg-white relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-black">
              Edit Terminal Configuration
            </h2>
            <span className="wabi-seal px-1.5 py-0.5 text-[9px] font-mono">
              EDIT
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-black hover:bg-zinc-100"
          >
            <IconClose size={16} />
          </button>
        </div>

        <p className="text-[11px] font-mono text-zinc-400 mb-5 truncate">
          Terminal UUID: {shop.id}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-black mb-1.5">
              Shop Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-black focus:outline-none focus:border-black"
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
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-black focus:outline-none focus:border-black"
              required
            />
          </div>


          {error && (
            <div className="p-3 rounded-xl bg-zinc-100 border border-zinc-300 text-xs text-black">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-100">
            {onOpenDeleteModal ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDeleteModal(shop);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 transition flex items-center gap-1.5 cursor-pointer"
                title="Offboard shop and permanently delete Google Auth account"
              >
                <IconTrash size={12} />
                <span>Offboard Shop...</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs text-zinc-600 hover:text-black"
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
          </div>
        </form>
      </div>
    </div>
  );
}

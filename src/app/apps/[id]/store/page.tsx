"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui";
import type {
  AppStoreListingRecord,
  GooglePlayMetadata,
  AppleAppStoreMetadata,
  StoreValidationResult,
} from "@/lib/store/types";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Save,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";

export default function AppStoreListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<"google" | "apple" | "assets">("google");
  const [listing, setListing] = useState<AppStoreListingRecord | null>(null);
  const [validation, setValidation] = useState<StoreValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadListing() {
      try {
        const res = await fetch(`/api/apps/${id}/store`);
        if (!res.ok) throw new Error("Failed to load store listing");
        const data = await res.json();
        setListing(data.listing);
        setValidation(data.validation);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    loadListing();
  }, [id]);

  async function handleSave() {
    if (!listing) return;
    setSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      const res = await fetch(`/api/apps/${id}/store`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(listing),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save listing");
      setListing(data.listing);
      setValidation(data.validation);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function updateGooglePlay(field: keyof GooglePlayMetadata, value: string) {
    if (!listing) return;
    setListing({
      ...listing,
      googlePlay: {
        ...listing.googlePlay,
        [field]: value,
      },
    });
  }

  function updateApple(field: keyof AppleAppStoreMetadata, value: string) {
    if (!listing) return;
    setListing({
      ...listing,
      apple: {
        ...listing.apple,
        [field]: value,
      },
    });
  }

  if (loading) {
    return (
      <PageShell title="Store Listing" description="Loading metadata...">
        <div className="p-12 text-center text-xs text-text-muted">Loading store listing drafts...</div>
      </PageShell>
    );
  }

  if (!listing) {
    return (
      <PageShell title="Store Listing" description="Store listing not available">
        <div className="border border-border bg-panel p-6 text-center text-xs">
          <p className="text-signal-danger mb-4">{error || "Could not load store listing."}</p>
          <Link href={`/apps/${id}`}>
            <Button variant="secondary">Back to App</Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Store Listing & Metadata Automation"
      description="Manage and validate production store listing descriptions, screenshots, and policy attestations."
      actions={
        <div className="flex items-center gap-2">
          <Link href={`/apps/${id}`}>
            <Button variant="secondary" className="text-xs h-8">
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Back to App
            </Button>
          </Link>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving}
            className="text-xs h-8"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saving ? "Saving Draft..." : "Save Store Metadata Draft"}
          </Button>
        </div>
      }
    >
      {saveSuccess && (
        <div className="mb-4 p-3 border border-signal-success/30 bg-signal-success/10 text-signal-success text-xs font-mono rounded flex items-center justify-between">
          <span>✓ Store listing metadata draft saved successfully.</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        <button
          onClick={() => setActiveTab("google")}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-all ${
            activeTab === "google"
              ? "border-signal-info text-signal-info"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          Google Play Console Listing
        </button>
        <button
          onClick={() => setActiveTab("apple")}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-all ${
            activeTab === "apple"
              ? "border-signal-info text-signal-info"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          Apple App Store Listing
        </button>
        <button
          onClick={() => setActiveTab("assets")}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-all ${
            activeTab === "assets"
              ? "border-signal-info text-signal-info"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          Store Assets & Screenshots Specs
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor Form (2 Cols) */}
        <div className="lg:col-span-2 border border-border bg-panel p-5 space-y-4 text-xs">
          {activeTab === "google" && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-mono text-[11px] text-text-muted uppercase">
                    App Title (Max 30 chars)
                  </label>
                  <span className={`font-mono text-[10px] ${listing.googlePlay.title.length > 30 ? "text-signal-danger font-bold" : "text-text-faint"}`}>
                    {listing.googlePlay.title.length} / 30
                  </span>
                </div>
                <input
                  type="text"
                  value={listing.googlePlay.title}
                  onChange={(e) => updateGooglePlay("title", e.target.value)}
                  className="w-full p-2 border border-border bg-panel-raised text-text font-mono text-xs focus:outline-none focus:border-signal-info"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-mono text-[11px] text-text-muted uppercase">
                    Short Description (Max 80 chars)
                  </label>
                  <span className={`font-mono text-[10px] ${listing.googlePlay.shortDescription.length > 80 ? "text-signal-danger font-bold" : "text-text-faint"}`}>
                    {listing.googlePlay.shortDescription.length} / 80
                  </span>
                </div>
                <input
                  type="text"
                  value={listing.googlePlay.shortDescription}
                  onChange={(e) => updateGooglePlay("shortDescription", e.target.value)}
                  placeholder="A quick summary of your app's main function"
                  className="w-full p-2 border border-border bg-panel-raised text-text text-xs focus:outline-none focus:border-signal-info"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-mono text-[11px] text-text-muted uppercase">
                    Full Description (Max 4000 chars)
                  </label>
                  <span className="font-mono text-[10px] text-text-faint">
                    {listing.googlePlay.fullDescription.length} / 4000
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={listing.googlePlay.fullDescription}
                  onChange={(e) => updateGooglePlay("fullDescription", e.target.value)}
                  placeholder="Comprehensive description detailing features, benefits, and usage instructions..."
                  className="w-full p-2 border border-border bg-panel-raised text-text text-xs focus:outline-none focus:border-signal-info font-sans"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] text-text-muted uppercase mb-1">
                  Release Notes (What's new in this release)
                </label>
                <textarea
                  rows={3}
                  value={listing.googlePlay.releaseNotes || ""}
                  onChange={(e) => updateGooglePlay("releaseNotes", e.target.value)}
                  placeholder="Bug fixes, new features, and performance enhancements..."
                  className="w-full p-2 border border-border bg-panel-raised text-text text-xs focus:outline-none focus:border-signal-info font-sans"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] text-text-muted uppercase mb-1">
                  Privacy Policy URL
                </label>
                <input
                  type="url"
                  value={listing.googlePlay.privacyPolicyUrl || ""}
                  onChange={(e) => updateGooglePlay("privacyPolicyUrl", e.target.value)}
                  placeholder="https://example.com/privacy"
                  className="w-full p-2 border border-border bg-panel-raised text-text font-mono text-xs focus:outline-none focus:border-signal-info"
                />
                <p className="text-[11px] text-text-faint mt-1 font-mono">
                  Required by Google Play before open testing and production release.
                </p>
              </div>
            </>
          )}

          {activeTab === "apple" && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-mono text-[11px] text-text-muted uppercase">
                    App Store Name (Max 30 chars)
                  </label>
                  <span className={`font-mono text-[10px] ${listing.apple.name.length > 30 ? "text-signal-danger font-bold" : "text-text-faint"}`}>
                    {listing.apple.name.length} / 30
                  </span>
                </div>
                <input
                  type="text"
                  value={listing.apple.name}
                  onChange={(e) => updateApple("name", e.target.value)}
                  className="w-full p-2 border border-border bg-panel-raised text-text font-mono text-xs focus:outline-none focus:border-signal-info"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-mono text-[11px] text-text-muted uppercase">
                    Subtitle (Max 30 chars)
                  </label>
                  <span className={`font-mono text-[10px] ${(listing.apple.subtitle || "").length > 30 ? "text-signal-danger font-bold" : "text-text-faint"}`}>
                    {(listing.apple.subtitle || "").length} / 30
                  </span>
                </div>
                <input
                  type="text"
                  value={listing.apple.subtitle || ""}
                  onChange={(e) => updateApple("subtitle", e.target.value)}
                  placeholder="Short tagline appearing under your app title"
                  className="w-full p-2 border border-border bg-panel-raised text-text text-xs focus:outline-none focus:border-signal-info"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-mono text-[11px] text-text-muted uppercase">
                    Keywords (Max 100 chars, comma-separated)
                  </label>
                  <span className={`font-mono text-[10px] ${(listing.apple.keywords || "").length > 100 ? "text-signal-danger font-bold" : "text-text-faint"}`}>
                    {(listing.apple.keywords || "").length} / 100
                  </span>
                </div>
                <input
                  type="text"
                  value={listing.apple.keywords || ""}
                  onChange={(e) => updateApple("keywords", e.target.value)}
                  placeholder="productivity, files, transfer, wifi"
                  className="w-full p-2 border border-border bg-panel-raised text-text text-xs focus:outline-none focus:border-signal-info font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-mono text-[11px] text-text-muted uppercase">
                    Description (Max 4000 chars)
                  </label>
                  <span className="font-mono text-[10px] text-text-faint">
                    {listing.apple.description.length} / 4000
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={listing.apple.description}
                  onChange={(e) => updateApple("description", e.target.value)}
                  placeholder="Detailed description of your application features..."
                  className="w-full p-2 border border-border bg-panel-raised text-text text-xs focus:outline-none focus:border-signal-info font-sans"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[11px] text-text-muted uppercase mb-1">
                    Support URL (Required)
                  </label>
                  <input
                    type="url"
                    value={listing.apple.supportUrl || ""}
                    onChange={(e) => updateApple("supportUrl", e.target.value)}
                    placeholder="https://example.com/support"
                    className="w-full p-2 border border-border bg-panel-raised text-text font-mono text-xs focus:outline-none focus:border-signal-info"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[11px] text-text-muted uppercase mb-1">
                    Privacy Policy URL
                  </label>
                  <input
                    type="url"
                    value={listing.apple.privacyPolicyUrl || ""}
                    onChange={(e) => updateApple("privacyPolicyUrl", e.target.value)}
                    placeholder="https://example.com/privacy"
                    className="w-full p-2 border border-border bg-panel-raised text-text font-mono text-xs focus:outline-none focus:border-signal-info"
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === "assets" && (
            <div className="space-y-4">
              <div className="border border-border bg-panel-raised/40 p-3 rounded">
                <h4 className="font-mono text-[11px] uppercase text-text font-bold mb-2">
                  Google Play Asset Specifications
                </h4>
                <ul className="list-disc ml-4 space-y-1 text-[11px] text-text-muted">
                  <li><strong>App Icon:</strong> 512 x 512 px, 32-bit PNG, max 1024 KB.</li>
                  <li><strong>Feature Graphic:</strong> 1024 x 500 px, JPG or 24-bit PNG (no alpha).</li>
                  <li><strong>Phone Screenshots:</strong> Minimum 2, up to 8. Aspect ratio between 16:9 and 9:16.</li>
                </ul>
              </div>

              <div className="border border-border bg-panel-raised/40 p-3 rounded">
                <h4 className="font-mono text-[11px] uppercase text-text font-bold mb-2">
                  Apple App Store Asset Specifications
                </h4>
                <ul className="list-disc ml-4 space-y-1 text-[11px] text-text-muted">
                  <li><strong>App Icon:</strong> 1024 x 1024 px, 72 dpi, RGB, flat, no transparency.</li>
                  <li><strong>6.7" iPhone Display:</strong> 1290 x 2796 px (portrait).</li>
                  <li><strong>6.5" iPhone Display:</strong> 1242 x 2688 px (portrait).</li>
                  <li><strong>12.9" iPad Pro Display:</strong> 2048 x 2732 px (portrait).</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Validation & Store Policy Inspector (1 Col) */}
        <div className="space-y-4">
          <div className="border border-border bg-panel p-4">
            <h3 className="text-xs font-mono uppercase text-text-muted mb-3 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-signal-info" />
              Store Policy Validation
            </h3>

            {validation?.errors && validation.errors.length > 0 && (
              <div className="mb-3 p-2.5 border border-signal-danger/30 bg-signal-danger/10 text-signal-danger text-[11px] font-mono rounded">
                <strong className="block mb-1">Errors ({validation.errors.length}):</strong>
                <ul className="list-disc ml-4 space-y-0.5">
                  {validation.errors.map((e, idx) => (
                    <li key={idx}>{e.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {validation?.warnings && validation.warnings.length > 0 && (
              <div className="p-2.5 border border-signal-warning/30 bg-signal-warning/10 text-signal-warning text-[11px] font-mono rounded">
                <strong className="block mb-1">Production Warnings ({validation.warnings.length}):</strong>
                <ul className="list-disc ml-4 space-y-0.5">
                  {validation.warnings.map((w, idx) => (
                    <li key={idx}>{w.message}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] text-text-faint">
                  Note: Warnings do not prevent local building or internal test track distribution.
                </p>
              </div>
            )}

            {validation?.valid && validation.warnings.length === 0 && (
              <div className="p-3 border border-signal-success/30 bg-signal-success/10 text-signal-success text-xs font-mono rounded flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                All store metadata requirements satisfied.
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

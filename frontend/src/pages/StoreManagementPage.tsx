import { getAuthToken } from "@/lib/auth/token";
import React, { useState, useEffect, useCallback } from 'react';
import {
  Storefront,
  Globe as Globe,
  ShareNetwork as Share2,
  QrCode as QrCode,
  Copy as Copy,
  Check as Check,
  Plus as Plus,
  Trash as Trash2,
  ArrowSquareOut as ExternalLink,
  Spinner as Loader2,
  Eye as Eye,
  PencilSimple as Edit3
} from "@phosphor-icons/react";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { Button } from '@/components/ui/button';
import type { StorefrontLink } from '@/types/storefront';
import { authFetch } from "@/lib/api/authFetch";
import { PageSecondaryNav, type PageNavTab } from "@/components/common/PageSecondaryNav";
import { ShareModal } from "@/components/common/ShareModal";

const SITE_BASE = window.location.origin;

export function StoreManagementPage() {
  const [storefront, setStorefront] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingPublish, setIsTogglingPublish] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [tagline, setTagline] = useState('');
  const [bio, setBio] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [links, setLinks] = useState<StorefrontLink[]>([]);

  const fetchStorefront = useCallback(async () => {
    const token = getAuthToken();
    try {
      const res = await authFetch(`/storefront`, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const json = await res.json();
        const data: any = json.data?.data ?? json.data;
        setStorefront(data);
        setDisplayName(data.display_name ?? '');
        setTagline(data.tagline ?? '');
        setBio(data.bio ?? '');
        setShortCode(data.short_code ?? '');
        setCoverUrl(data.cover_url ?? '');
        setAvatarUrl(data.avatar_url ?? '');
        setLinks(Array.isArray(data.links) ? data.links : []);
      }
    } catch {
      setError('Failed to load storefront data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStorefront();
  }, [fetchStorefront]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    const token = getAuthToken();
    try {
      const res = await authFetch(`/storefront`, {
        method: 'PUT',
        headers: {
          'Content-TextT': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          display_name: displayName,
          tagline,
          bio,
          short_code: shortCode,
          cover_url: coverUrl || null,
          avatar_url: avatarUrl || null,
          links: links.filter((l) => l.label.trim() && l.url.trim()),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Save failed.');

      setStorefront(json.data?.data ?? json.data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!storefront) return;
    setIsTogglingPublish(true);

    const token = getAuthToken();
    try {
      const res = await authFetch(`/storefront/publish`, {
        method: 'POST',
        headers: {
          'Content-TextT': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ is_published: !storefront.is_published }),
      });

      if (res.ok) {
        const json = await res.json();
        setStorefront(json.data?.data ?? json.data);
      }
    } catch (e) { console.error('Failed to toggle publish', e); } finally {
      setIsTogglingPublish(false);
    }
  };

  const publicUrl = `${SITE_BASE}/store/${shortCode}`;

  const copyShortLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addLink = () => {
    if (links.length >= 10) return;
    setLinks([...links, { label: '', url: '' }]);
  };

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const updateLink = (index: number, key: 'label' | 'url', value: string) => {
    setLinks(links.map((l, i) => (i === index ? { ...l, [key]: value } : l)));
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center space-y-2">
        <Loader2 weight="fill" className="h-8 w-8 animate-spin text-secondary mx-auto" />
        <p className="text-xs text-muted-foreground font-medium">Loading Storefront setup…</p>
      </div>
    );
  }

  const storeTabs: PageNavTab[] = [
    { label: "Overview", href: "/app/store", exact: true },
    { label: "Digital Products", href: "/app/store/digital" },
    { label: "Physical Products", href: "/app/store/physical-products" },
    { label: "Catalog", href: "/app/store/products" },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto p-4 lg:p-5 space-y-6">
      <PageSecondaryNav
        title="Creator Storefront & Catalog"
        subtitle="Customize your public store page, manage digital and physical items, and share your brand."
        icon={<Storefront weight="fill" className="h-5 w-5 text-secondary" />}
        tabs={storeTabs}
        actions={
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleTogglePublish}
              disabled={isTogglingPublish}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                storefront?.is_published
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/25'
                  : 'bg-amber-500/15 border border-amber-500/30 text-amber-600 hover:bg-amber-500/25'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  storefront?.is_published ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              {storefront?.is_published ? 'Published' : 'Draft'}
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowShareModal(true)}
              className="h-8 text-xs font-semibold gap-1.5 rounded-lg border-primary/40 text-primary hover:bg-primary/10"
            >
              <Share2 weight="fill" className="h-3.5 w-3.5" />
              Share Store
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={copyShortLink}
              className="h-8 text-xs font-semibold gap-1.5 rounded-lg"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy weight="fill" className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQrModal(true)}
              className="h-8 text-xs font-semibold gap-1.5 rounded-lg"
            >
              <QrCode weight="fill" className="h-3.5 w-3.5 text-secondary" />
              QR Code
            </Button>
          </div>
        }
      />

      {error && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          {error}
        </div>
      )}

      {/* Grid: Form Editor vs Live Card Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Form Settings */}
        <form onSubmit={handleSave} className="lg:col-span-7 space-y-6">
          <div className="border-none rounded-lg bg-card p-5 space-y-4 ">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Edit3 weight="fill" className="h-4 w-4 text-secondary" />
              Basic Storefront Settings
            </h3>

            <div className="space-y-1.5">
              <label htmlFor="sm-title" className="text-xs font-bold text-foreground uppercase tracking-wider">
                Storefront Title
              </label>
              <input
                id="sm-title"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex Morgan Studio"
                required
                className="w-full px-3.5 py-2 text-xs rounded-lg bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sm-handle" className="text-xs font-bold text-foreground uppercase tracking-wider">
                Custom Short Handle
              </label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-3 py-2 rounded-l-xl border border-r-0 border-border">
                  /store/
                </span>
                <input
                  id="sm-handle"
                  type="text"
                  onChange={(e) => setShortCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="alex-morgan"
                  required
                  className="flex-1 px-3.5 py-2 text-xs rounded-r-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sm-tagline" className="text-xs font-bold text-foreground uppercase tracking-wider">
                Tagline
              </label>
              <input
                id="sm-tagline"
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Digital Design Resources & Creator Mentorship"
                className="w-full px-3.5 py-2 text-xs rounded-lg bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sm-bio" className="text-xs font-bold text-foreground uppercase tracking-wider">
                Biography / Description
              </label>
              <textarea
                id="sm-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Describe your brand, offerings, and value for your audience…"
                rows={3}
                className="w-full px-3.5 py-2 text-xs rounded-lg bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary resize-none"
              />
            </div>
          </div>

          {/* Media Images */}
          <div className="border-none rounded-lg bg-card p-5 space-y-4 ">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Globe weight="fill" className="h-4 w-4 text-secondary" />
              Branding & Imagery
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                Cover Image (1200x400 recommended)
              </label>
              <ImageUploader
                value={coverUrl}
                onChange={setCoverUrl}
                folder="storefronts/covers"
                label=""
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                Avatar Image (Optional override)
              </label>
              <ImageUploader
                value={avatarUrl}
                onChange={setAvatarUrl}
                folder="storefronts/avatars"
                label=""
              />
            </div>
          </div>

          {/* Social / External Links Builder */}
          <div className="border-none rounded-lg bg-card p-5 space-y-4 ">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Share2 weight="fill" className="h-4 w-4 text-secondary" />
                Community & External Links ({links.length}/10)
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLink}
                disabled={links.length >= 10}
                className="h-8 text-xs font-semibold gap-1 rounded-lg"
              >
                <Plus weight="fill" className="h-3.5 w-3.5" />
                Add Link
              </Button>
            </div>

            {links.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4 italic">
                No external links added yet. Add Twitter, YouTube, or portfolio links for your buyers.
              </p>
            ) : (
              <div className="space-y-2.5">
                {links.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={link.label}
                      onChange={(e) => updateLink(idx, 'label', e.target.value)}
                      placeholder="Label (e.g. YouTube)"
                      className="w-1/3 px-3 py-1.5 text-xs rounded-lg bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary"
                    />
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => updateLink(idx, 'url', e.target.value)}
                      placeholder="https://youtube.com/@..."
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary"
                    />
                    <button
                      type="button"
                      onClick={() => removeLink(idx)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors shrink-0"
                    >
                      <Trash2 weight="fill" className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {saveSuccess && (
              <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                <Check weight="fill" className="h-4 w-4" /> Storefront saved successfully!
              </span>
            )}
            <Button
              type="submit"
              disabled={isSaving}
              className="text-xs font-bold gap-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground px-6 h-10 rounded-lg "
            >
              {isSaving ? 'Saving Storefront…' : 'Save Changes'}
            </Button>
          </div>
        </form>

        {/* Right Column: Live Storefront Preview Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Eye weight="fill" className="h-3.5 w-3.5 text-[#2164b6] dark:text-[#7ab0ff]" />
              Live Storefront Preview
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowShareModal(true)}
                className="h-7 text-xs font-semibold gap-1 rounded-lg"
              >
                <Share2 weight="fill" className="h-3 w-3" /> Share
              </Button>
              <a
                href={`${publicUrl}${storefront?.is_published ? '' : '?preview=true'}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-[#2164b6] dark:text-[#7ab0ff] hover:bg-[#2164b6]/10 px-2.5 py-1 rounded-lg border border-[#2164b6]/30 transition-all flex items-center gap-1.5"
              >
                {storefront?.is_published ? 'Open Store' : 'Preview Store'} <ExternalLink weight="fill" className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Card Mockup */}
          <div className="border-none rounded-lg bg-card overflow-hidden shadow-lg transition-all">
            {/* Cover */}
            <div className="h-32 bg-[#1877f2]/15 dark:bg-[#242526] border-b border-border relative overflow-hidden">
              {coverUrl ? (
                <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                  <Storefront weight="fill" className="h-10 w-10" />
                </div>
              )}
            </div>

            {/* Avatar & Content Body */}
            <div className="p-5 pt-0 relative space-y-3">
              <div className="flex items-end justify-between -mt-10 mb-2">
                <div className="h-16 w-16 rounded-full border-4 border-card bg-[#2164b6] text-white font-bold flex items-center justify-center text-xl  overflow-hidden shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    displayName.slice(0, 2).toUpperCase()
                  )}
                </div>

                <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#2164b6]/15 text-[#2164b6] dark:text-[#7ab0ff] border border-[#2164b6]/30 ">
                  @{shortCode || 'handle'}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-black text-foreground">{displayName || 'Storefront Title'}</h3>
                <p className="text-xs font-medium text-muted-foreground mt-0.5">{tagline || 'Tagline goes here'}</p>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {bio || 'Your bio and creator mission statement will appear here for buyers.'}
              </p>

              {/* Links Teaser */}
              {links.filter((l) => l.label && l.url).length > 0 && (
                <div className="pt-2 space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Community & Social Links
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {links
                      .filter((l) => l.label && l.url)
                      .map((l, i) => (
                        <a
                          key={i}
                          href={l.url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-muted text-[11px] font-semibold text-foreground hover:bg-secondary/20 hover:text-secondary transition-colors inline-flex items-center gap-1"
                        >
                          {l.label} <ExternalLink weight="fill" className="h-2.5 w-2.5" />
                        </a>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="border-none rounded-lg bg-card p-4 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <h3 className="text-base font-bold text-foreground">Storefront QR Code</h3>
            <p className="text-xs text-muted-foreground">
              Scan to open your public creator storefront on mobile.
            </p>

            <div className="p-4 bg-white rounded-lg w-48 h-48 mx-auto flex items-center justify-center border-none shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(publicUrl)}`}
                alt="QR Code"
                className="w-full h-full object-contain"
              />
            </div>

            <p className="text-[11px] font-mono text-muted-foreground truncate">{publicUrl}</p>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQrModal(false)}
              className="w-full text-xs font-semibold rounded-lg"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={displayName || "Creator Storefront"}
        description={tagline || bio || "Explore my official creator storefront on MurihSpace"}
        url={publicUrl}
        type="store"
        imageUrl={avatarUrl || coverUrl}
        badge={storefront?.is_published ? "Storefront" : "Draft Store"}
      />
    </div>
  );
}

import React, { useState } from 'react';
import { Setting as GearSix, TickSquare as Check, Discovery as Globe, ShieldDone as ShieldCheck } from '@/components/icons';
import { Copy, ArrowSquareOut } from '@/components/icons/rounded';
import { Button } from '@/components/ui/button';

interface StoreSettingsTabProps {
  displayName: string;
  shortCode: string;
  tagline: string;
  bio: string;
  isPublished: boolean;
  publicUrl: string;
  onSave: (data: {
    displayName: string;
    shortCode: string;
    tagline: string;
    bio: string;
  }) => Promise<boolean>;
  onTogglePublish: () => void;
  isSaving: boolean;
  isTogglingPublish: boolean;
}

export const StoreSettingsTab: React.FC<StoreSettingsTabProps> = ({
  displayName,
  shortCode,
  tagline,
  bio,
  isPublished,
  publicUrl,
  onSave,
  onTogglePublish,
  isSaving,
  isTogglingPublish,
}) => {
  const [formDisplayName, setFormDisplayName] = useState(displayName);
  const [formShortCode, setFormShortCode] = useState(shortCode);
  const [formTagline, setFormTagline] = useState(tagline);
  const [formBio, setFormBio] = useState(bio);
  const [copied, setCopied] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(false);

    if (!formDisplayName.trim()) {
      setErrorMsg('Store title cannot be empty.');
      return;
    }

    const cleanHandle = formShortCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanHandle) {
      setErrorMsg('Please specify a valid alphanumeric store handle.');
      return;
    }

    const ok = await onSave({
      displayName: formDisplayName.trim(),
      shortCode: cleanHandle,
      tagline: formTagline.trim(),
      bio: formBio.trim(),
    });

    if (ok) {
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 3000);
    } else {
      setErrorMsg('Failed to update storefront settings.');
    }
  };

  return (
    <div className="space-y-6 pt-2 max-w-4xl">
      {/* Top Banner */}
      <div className="bg-[#171D25] border border-[#29313C] rounded-2xl p-5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[#087FFF]">
            <GearSix className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Store Settings</h3>
            <p className="text-xs text-[#A7B0BE] mt-0.5">
              Configure your store handle, visibility preferences, and public metadata.
            </p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <Check className="h-4 w-4" />
          Storefront settings saved successfully!
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Store Handle & URL Section */}
        <div className="bg-[#171D25] border border-[#29313C] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#29313C]/60">
            <Globe className="h-4 w-4 text-[#087FFF]" />
            <h4 className="text-sm font-bold text-white">Public URL & Slug</h4>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[#A7B0BE] uppercase tracking-wider">
              Custom Short Handle
            </label>
            <div className="flex items-center bg-[#0B0F14] border border-[#29313C] rounded-xl overflow-hidden focus-within:border-[#087FFF]">
              <span className="px-3.5 text-xs text-[#A7B0BE] font-semibold bg-[#202731] border-r border-[#29313C] py-2.5">
                {window.location.origin}/store/
              </span>
              <input
                type="text"
                value={formShortCode}
                onChange={(e) => setFormShortCode(e.target.value)}
                className="w-full bg-transparent px-3.5 py-2.5 text-sm text-white focus:outline-none"
                placeholder="web3nexus"
              />
            </div>
            <p className="text-[11px] text-[#5A6577]">
              Buyers access your store at this link. Use letters, numbers, and hyphens only.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="bg-[#202731] border-[#29313C] text-[#F5F7FA] hover:text-white text-xs font-semibold gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'Link Copied!' : 'Copy Full Link'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open(publicUrl, '_blank')}
              className="bg-[#202731] border-[#29313C] text-[#F5F7FA] hover:text-white text-xs font-semibold gap-1.5"
            >
              <ArrowSquareOut className="h-3.5 w-3.5" />
              Visit Public Store
            </Button>
          </div>
        </div>

        {/* Store Profile Details */}
        <div className="bg-[#171D25] border border-[#29313C] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#29313C]/60">
            <ShieldCheck className="h-4 w-4 text-[#087FFF]" />
            <h4 className="text-sm font-bold text-white">Store Identity Details</h4>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#A7B0BE] uppercase tracking-wider mb-1.5">
              Store Title
            </label>
            <input
              type="text"
              value={formDisplayName}
              onChange={(e) => setFormDisplayName(e.target.value)}
              className="w-full bg-[#0B0F14] border border-[#29313C] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#087FFF]"
              placeholder="e.g. Vincent"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#A7B0BE] uppercase tracking-wider mb-1.5">
              Tagline
            </label>
            <input
              type="text"
              value={formTagline}
              onChange={(e) => setFormTagline(e.target.value)}
              className="w-full bg-[#0B0F14] border border-[#29313C] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#087FFF]"
              placeholder="Welcome to my official creator storefront."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#A7B0BE] uppercase tracking-wider mb-1.5">
              Biography & About
            </label>
            <textarea
              rows={3}
              value={formBio}
              onChange={(e) => setFormBio(e.target.value)}
              className="w-full bg-[#0B0F14] border border-[#29313C] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#087FFF] resize-none"
              placeholder="Tell visitors what you make and share..."
            />
          </div>
        </div>

        {/* Visibility & Publication */}
        <div className="bg-[#171D25] border border-[#29313C] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white">Storefront Visibility</h4>
              <p className="text-xs text-[#A7B0BE] mt-0.5">
                {isPublished
                  ? 'Your store is currently live and viewable by everyone.'
                  : 'Your store is currently in draft mode and hidden from public visitors.'}
              </p>
            </div>
            <Button
              type="button"
              onClick={onTogglePublish}
              disabled={isTogglingPublish}
              className={`text-xs font-bold rounded-xl px-4 py-2 ${
                isPublished
                  ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25'
                  : 'bg-[#087FFF] hover:bg-[#0770E3] text-white'
              }`}
            >
              {isTogglingPublish ? 'Updating…' : isPublished ? 'Unpublish Store' : 'Publish Store Now'}
            </Button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={isSaving}
            className="h-10 px-6 bg-[#087FFF] hover:bg-[#0770E3] text-white font-bold text-xs rounded-xl shadow-md transition-all"
          >
            {isSaving ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
};


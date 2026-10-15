import React, { useState } from 'react';
import { Edit as Edit3, TickSquare as Check, CloseSquare as X, Camera } from '@/components/icons';
import { Spinner } from '@/components/icons/rounded';
import { Button } from '@/components/ui/button';

interface StoreIdentityCardProps {
  displayName: string;
  shortCode: string;
  tagline: string;
  bio: string;
  avatarUrl?: string;
  userInitials: string;
  isSaving: boolean;
  onSave: (data: {
    displayName: string;
    shortCode: string;
    tagline: string;
    bio: string;
  }) => Promise<boolean>;
  onOpenAvatarUpload?: () => void;
}

export const StoreIdentityCard: React.FC<StoreIdentityCardProps> = ({
  displayName,
  shortCode,
  tagline,
  bio,
  avatarUrl,
  userInitials,
  isSaving,
  onSave,
  onOpenAvatarUpload,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formDisplayName, setFormDisplayName] = useState(displayName);
  const [formShortCode, setFormShortCode] = useState(shortCode);
  const [formTagline, setFormTagline] = useState(tagline);
  const [formBio, setFormBio] = useState(bio);
  const [validationError, setValidationError] = useState<string | null>(null);

  const startEdit = () => {
    setFormDisplayName(displayName);
    setFormShortCode(shortCode);
    setFormTagline(tagline);
    setFormBio(bio);
    setValidationError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setValidationError(null);
  };

  const handleSave = async () => {
    if (!formDisplayName.trim()) {
      setValidationError('Store title is required.');
      return;
    }
    const cleanShortCode = formShortCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanShortCode) {
      setValidationError('Custom short handle cannot be empty and must be alphanumeric.');
      return;
    }

    const success = await onSave({
      displayName: formDisplayName.trim(),
      shortCode: cleanShortCode,
      tagline: formTagline.trim(),
      bio: formBio.trim(),
    });

    if (success) {
      setIsEditing(false);
      setValidationError(null);
    }
  };

  return (
    <div className="bg-[#171D25] border border-[#29313C] rounded-2xl p-5 sm:p-6 transition-all shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#29313C]/60 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full bg-[#087FFF]" />
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Store identity</h3>
            <p className="text-xs text-[#A7B0BE] mt-0.5">This information appears on your public storefront.</p>
          </div>
        </div>

        {!isEditing ? (
          <Button
            variant="outline"
            size="sm"
            onClick={startEdit}
            className="h-8 px-3 text-xs font-semibold rounded-lg bg-[#202731] border-[#29313C] text-[#F5F7FA] hover:bg-[#29313C] hover:text-white transition-all gap-1.5"
          >
            <Edit3 className="h-3.5 w-3.5 text-[#A7B0BE]" />
            Edit
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={cancelEdit}
              disabled={isSaving}
              className="h-8 px-2.5 text-xs font-medium rounded-lg bg-[#202731] border-[#29313C] text-[#A7B0BE] hover:text-white"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="h-8 px-3 text-xs font-bold rounded-lg bg-[#087FFF] hover:bg-[#0770E3] text-white gap-1"
            >
              {isSaving ? (
                <Spinner weight="bold" className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Save
            </Button>
          </div>
        )}
      </div>

      {validationError && (
        <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
          {validationError}
        </div>
      )}

      {/* Main Content Layout */}
      <div className="flex flex-col sm:flex-row items-start gap-5">
        {/* Avatar preview / button */}
        <div className="relative shrink-0 group self-center sm:self-start">
          <div className="h-20 w-20 rounded-full bg-[#087FFF] border-2 border-[#29313C] flex items-center justify-center text-white text-xl font-black overflow-hidden shadow-md">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <span>{userInitials || 'VI'}</span>
            )}
          </div>
          {onOpenAvatarUpload && (
            <button
              onClick={onOpenAvatarUpload}
              title="Change avatar"
              type="button"
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-[#202731] border border-[#29313C] flex items-center justify-center text-[#A7B0BE] hover:text-white hover:bg-[#29313C] transition-colors shadow"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Inputs / Fields */}
        <div className="flex-1 w-full space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Store Title */}
            <div>
              <label className="block text-[11px] font-bold text-[#A7B0BE] uppercase tracking-wider mb-1.5">
                Store title
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  className="w-full bg-[#0B0F14] border border-[#29313C] rounded-xl px-3.5 py-2 text-sm text-white placeholder-[#5A6577] focus:outline-none focus:border-[#087FFF] transition-colors"
                  placeholder="e.g. Vincent"
                />
              ) : (
                <div className="w-full bg-[#0B0F14]/70 border border-[#29313C]/80 rounded-xl px-3.5 py-2 text-sm text-white font-medium">
                  {displayName || 'Untitled Store'}
                </div>
              )}
            </div>

            {/* Custom Short Handle */}
            <div>
              <label className="block text-[11px] font-bold text-[#A7B0BE] uppercase tracking-wider mb-1.5">
                Custom short handle
              </label>
              {isEditing ? (
                <div className="flex items-center bg-[#0B0F14] border border-[#29313C] rounded-xl overflow-hidden focus-within:border-[#087FFF] transition-colors">
                  <span className="px-3 text-xs text-[#A7B0BE] font-semibold bg-[#202731]/60 border-r border-[#29313C] select-none py-2">
                    /store/
                  </span>
                  <input
                    type="text"
                    value={formShortCode}
                    onChange={(e) => setFormShortCode(e.target.value)}
                    className="w-full bg-transparent px-3 py-2 text-sm text-white placeholder-[#5A6577] focus:outline-none"
                    placeholder="web3nexus"
                  />
                </div>
              ) : (
                <div className="flex items-center bg-[#0B0F14]/70 border border-[#29313C]/80 rounded-xl overflow-hidden">
                  <span className="px-3 text-xs text-[#A7B0BE] font-semibold bg-[#202731]/40 border-r border-[#29313C]/60 select-none py-2">
                    /store/
                  </span>
                  <span className="px-3 py-2 text-sm text-white font-medium">
                    {shortCode || 'handle'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tagline */}
          <div>
            <label className="block text-[11px] font-bold text-[#A7B0BE] uppercase tracking-wider mb-1.5">
              Tagline
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formTagline}
                onChange={(e) => setFormTagline(e.target.value)}
                className="w-full bg-[#0B0F14] border border-[#29313C] rounded-xl px-3.5 py-2 text-sm text-white placeholder-[#5A6577] focus:outline-none focus:border-[#087FFF] transition-colors"
                placeholder="Welcome to my official creator storefront."
              />
            ) : (
              <div className="w-full bg-[#0B0F14]/70 border border-[#29313C]/80 rounded-xl px-3.5 py-2 text-sm text-[#F5F7FA]">
                {tagline || <span className="text-[#5A6577] italic">No tagline added yet.</span>}
              </div>
            )}
          </div>

          {/* Biography / Description */}
          <div>
            <label className="block text-[11px] font-bold text-[#A7B0BE] uppercase tracking-wider mb-1.5">
              Biography / Description
            </label>
            {isEditing ? (
              <textarea
                rows={2}
                value={formBio}
                onChange={(e) => setFormBio(e.target.value)}
                className="w-full bg-[#0B0F14] border border-[#29313C] rounded-xl px-3.5 py-2 text-sm text-white placeholder-[#5A6577] focus:outline-none focus:border-[#087FFF] transition-colors resize-none"
                placeholder="Explore my digital products, community memberships, and exclusive content."
              />
            ) : (
              <div className="w-full bg-[#0B0F14]/70 border border-[#29313C]/80 rounded-xl px-3.5 py-2 text-sm text-[#A7B0BE] leading-relaxed">
                {bio || <span className="text-[#5A6577] italic">No biography added yet.</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


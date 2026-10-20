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
    <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-5 sm:p-6 transition-all shadow-sm h-full flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--shell-border)]/60 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full bg-[var(--shell-accent-solid)]" />
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Store identity</h3>
            <p className="text-xs text-[var(--shell-muted)] mt-0.5">This information appears on your public storefront.</p>
          </div>
        </div>

        {!isEditing ? (
          <Button
            variant="outline"
            size="sm"
            onClick={startEdit}
            className="h-8 px-3 text-xs font-semibold rounded-lg bg-[var(--shell-surface)] border-[var(--shell-border)] text-[var(--shell-text)] hover:bg-[var(--shell-hover-strong)] hover:text-white transition-all gap-1.5"
          >
            <Edit3 className="h-3.5 w-3.5 text-[var(--shell-muted)]" />
            Edit
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={cancelEdit}
              disabled={isSaving}
              className="h-8 px-2.5 text-xs font-medium rounded-lg bg-[var(--shell-surface)] border-[var(--shell-border)] text-[var(--shell-muted)] hover:text-white"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="h-8 px-3 text-xs font-bold rounded-lg bg-[var(--shell-accent-solid)] hover:bg-[var(--shell-accent-hover)] text-white gap-1"
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
          <div className="h-20 w-20 rounded-full bg-[var(--shell-accent-solid)] border-2 border-[var(--shell-border)] flex items-center justify-center text-white text-xl font-black overflow-hidden shadow-md">
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
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-[var(--shell-surface)] border border-[var(--shell-border)] flex items-center justify-center text-[var(--shell-muted)] hover:text-white hover:bg-[var(--shell-hover-strong)] transition-colors shadow"
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
              <label htmlFor="f-ore-tabs-storeidentitycard-tsx-164" className="block text-[11px] font-bold text-[var(--shell-muted)] uppercase tracking-wider mb-1.5">
                Store title
              </label>
              {isEditing ? (
                <input id="f-ore-tabs-storeidentitycard-tsx-164"
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  className="w-full bg-[var(--shell-canvas)] border border-[var(--shell-border)] rounded-xl px-3.5 py-2 text-sm text-white placeholder-[var(--shell-muted)] focus:outline-none focus:border-[var(--shell-accent)] transition-colors"
                  placeholder="e.g. Vincent"
                />
              ) : (
                <div className="w-full bg-[var(--shell-canvas)]/70 border border-[var(--shell-border)]/80 rounded-xl px-3.5 py-2 text-sm text-white font-medium">
                  {displayName || 'Untitled Store'}
                </div>
              )}
            </div>

            {/* Custom Short Handle */}
            <div>
              <label htmlFor="store-short-handle" className="block text-[11px] font-bold text-[var(--shell-muted)] uppercase tracking-wider mb-1.5">
                Custom short handle
              </label>
              {isEditing ? (
                <div className="flex items-center bg-[var(--shell-canvas)] border border-[var(--shell-border)] rounded-xl overflow-hidden focus-within:border-[#087FFF] transition-colors">
                  <span className="px-3 text-xs text-[var(--shell-muted)] font-semibold bg-[var(--shell-surface)]/60 border-r border-[var(--shell-border)] select-none py-2">
                    /store/
                  </span>
                  <input
                    id="store-short-handle"
                    type="text"
                    value={formShortCode}
                    onChange={(e) => setFormShortCode(e.target.value)}
                    className="w-full bg-transparent px-3 py-2 text-sm text-white placeholder-[var(--shell-muted)] focus:outline-none"
                    placeholder="web3nexus"
                  />
                </div>
              ) : (
                <div className="flex items-center bg-[var(--shell-canvas)]/70 border border-[var(--shell-border)]/80 rounded-xl overflow-hidden">
                  <span className="px-3 text-xs text-[var(--shell-muted)] font-semibold bg-[var(--shell-surface)]/40 border-r border-[var(--shell-border)]/60 select-none py-2">
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
            <label htmlFor="f-ore-tabs-storeidentitycard-tsx-215" className="block text-[11px] font-bold text-[var(--shell-muted)] uppercase tracking-wider mb-1.5">
              Tagline
            </label>
            {isEditing ? (
              <input id="f-ore-tabs-storeidentitycard-tsx-215"
                type="text"
                value={formTagline}
                onChange={(e) => setFormTagline(e.target.value)}
                className="w-full bg-[var(--shell-canvas)] border border-[var(--shell-border)] rounded-xl px-3.5 py-2 text-sm text-white placeholder-[var(--shell-muted)] focus:outline-none focus:border-[var(--shell-accent)] transition-colors"
                placeholder="Welcome to my official creator storefront."
              />
            ) : (
              <div className="w-full bg-[var(--shell-canvas)]/70 border border-[var(--shell-border)]/80 rounded-xl px-3.5 py-2 text-sm text-[var(--shell-text)]">
                {tagline || <span className="text-[var(--shell-muted)] italic">No tagline added yet.</span>}
              </div>
            )}
          </div>

          {/* Biography / Description */}
          <div>
            <label htmlFor="f-ore-tabs-storeidentitycard-tsx-235" className="block text-[11px] font-bold text-[var(--shell-muted)] uppercase tracking-wider mb-1.5">
              Biography / Description
            </label>
            {isEditing ? (
              <textarea id="f-ore-tabs-storeidentitycard-tsx-235"
                rows={2}
                value={formBio}
                onChange={(e) => setFormBio(e.target.value)}
                className="w-full bg-[var(--shell-canvas)] border border-[var(--shell-border)] rounded-xl px-3.5 py-2 text-sm text-white placeholder-[var(--shell-muted)] focus:outline-none focus:border-[var(--shell-accent)] transition-colors resize-none"
                placeholder="Explore my digital products, community memberships, and exclusive content."
              />
            ) : (
              <div className="w-full bg-[var(--shell-canvas)]/70 border border-[var(--shell-border)]/80 rounded-xl px-3.5 py-2 text-sm text-[var(--shell-muted)] leading-relaxed">
                {bio || <span className="text-[var(--shell-muted)] italic">No biography added yet.</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


import React from 'react';
import { TickSquare as Check } from '@/components/icons';
import { Palette } from '@/components/icons/rounded';
import { Button } from '@/components/ui/button';
import { BrandAssetsCard } from './BrandAssetsCard';
import { StorefrontPreviewCard } from './StorefrontPreviewCard';

interface StoreDesignTabProps {
  displayName: string;
  shortCode: string;
  tagline: string;
  bio: string;
  coverUrl?: string;
  avatarUrl?: string;
  userInitials: string;
  publicUrl: string;
  onCoverChange: (url: string) => void;
  onAvatarChange: (url: string) => void;
  onSaveAll: () => Promise<void>;
  isSaving: boolean;
}

export const StoreDesignTab: React.FC<StoreDesignTabProps> = ({
  displayName,
  shortCode,
  tagline,
  bio,
  coverUrl,
  avatarUrl,
  userInitials,
  publicUrl,
  onCoverChange,
  onAvatarChange,
  onSaveAll,
  isSaving,
}) => {
  return (
    <div className="space-y-6 pt-2">
      {/* Top action header */}
      <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[var(--shell-accent-solid)]/10 border border-[var(--shell-accent)]/20 flex items-center justify-center text-[var(--shell-accent)]">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Store Design & Branding</h3>
            <p className="text-xs text-[var(--shell-muted)] mt-0.5">
              Customize your banner graphics, storefront avatar, and visual theme presentation.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={onSaveAll}
          disabled={isSaving}
          className="h-9 px-4 text-xs font-bold rounded-xl bg-[var(--shell-accent-solid)] hover:bg-[var(--shell-accent-hover)] text-white flex items-center gap-1.5 shadow-sm"
        >
          <Check className="h-4 w-4" />
          {isSaving ? 'Saving…' : 'Save Design Changes'}
        </Button>
      </div>

      {/* Grid: Assets Uploader vs Real-time Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-5 flex flex-col">
          <BrandAssetsCard
            coverUrl={coverUrl}
            avatarUrl={avatarUrl}
            onCoverChange={onCoverChange}
            onAvatarChange={onAvatarChange}
          />
        </div>
        <div className="lg:col-span-7 flex flex-col">
          <StorefrontPreviewCard
            displayName={displayName}
            shortCode={shortCode}
            tagline={tagline}
            bio={bio}
            coverUrl={coverUrl}
            avatarUrl={avatarUrl}
            userInitials={userInitials}
            publicUrl={publicUrl}
          />
        </div>
      </div>
    </div>
  );
};


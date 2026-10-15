import React from 'react';
import { StoreIdentityCard } from './StoreIdentityCard';
import { StoreHealthCard } from './StoreHealthCard';
import { StorefrontPreviewCard } from './StorefrontPreviewCard';
import { BrandAssetsCard } from './BrandAssetsCard';
import { ProductSummaryCards } from './ProductSummaryCards';
import { CommunityLinksCard } from './CommunityLinksCard';
import type { StorefrontLink } from '@/types/storefront';

interface StoreOverviewTabProps {
  displayName: string;
  shortCode: string;
  tagline: string;
  bio: string;
  coverUrl?: string;
  avatarUrl?: string;
  userInitials: string;
  publicUrl: string;
  links: StorefrontLink[];
  digitalCount: number;
  physicalCount: number;
  collectionsCount: number;
  isSaving: boolean;
  onSaveIdentity: (data: {
    displayName: string;
    shortCode: string;
    tagline: string;
    bio: string;
  }) => Promise<boolean>;
  onCoverChange: (url: string) => void;
  onAvatarChange: (url: string) => void;
  onSaveLinks: (links: StorefrontLink[]) => Promise<boolean>;
  onNavigateTab: (tab: 'products' | 'collections' | 'design' | 'settings') => void;
}

export const StoreOverviewTab: React.FC<StoreOverviewTabProps> = ({
  displayName,
  shortCode,
  tagline,
  bio,
  coverUrl,
  avatarUrl,
  userInitials,
  publicUrl,
  links,
  digitalCount,
  physicalCount,
  collectionsCount,
  isSaving,
  onSaveIdentity,
  onCoverChange,
  onAvatarChange,
  onSaveLinks,
  onNavigateTab,
}) => {
  return (
    <div className="space-y-6 pt-2">
      {/* Row 1: Store Identity (60%) + Store Health (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7 flex flex-col">
          <StoreIdentityCard
            displayName={displayName}
            shortCode={shortCode}
            tagline={tagline}
            bio={bio}
            avatarUrl={avatarUrl}
            userInitials={userInitials}
            isSaving={isSaving}
            onSave={onSaveIdentity}
            onOpenAvatarUpload={() => onNavigateTab('design')}
          />
        </div>
        <div className="lg:col-span-5 flex flex-col">
          <StoreHealthCard
            hasCover={Boolean(coverUrl)}
            hasProducts={digitalCount + physicalCount > 0}
            hasLinks={links.length > 0}
            onNavigateToCover={() => onNavigateTab('design')}
            onNavigateToProducts={() => onNavigateTab('products')}
            onNavigateToLinks={() => {
              const el = document.getElementById('community-links-section');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </div>
      </div>

      {/* Row 2: Storefront Preview (60%) + Brand Assets (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
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
        <div className="lg:col-span-5 flex flex-col">
          <BrandAssetsCard
            coverUrl={coverUrl}
            avatarUrl={avatarUrl}
            onCoverChange={onCoverChange}
            onAvatarChange={onAvatarChange}
          />
        </div>
      </div>

      {/* Row 3: Product Summary & Quick Action Cards (4 columns) */}
      <ProductSummaryCards
        digitalCount={digitalCount}
        physicalCount={physicalCount}
        collectionsCount={collectionsCount}
        onNavigateToDigital={() => onNavigateTab('products')}
        onNavigateToPhysical={() => onNavigateTab('products')}
        onNavigateToCollections={() => onNavigateTab('collections')}
        onAddProduct={() => onNavigateTab('products')}
      />

      {/* Row 4: Community & Links Wide Card */}
      <div id="community-links-section">
        <CommunityLinksCard
          links={links}
          onSaveLinks={onSaveLinks}
        />
      </div>
    </div>
  );
};


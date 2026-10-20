import { logger } from "@/lib/logger";
import { asApiError } from "@/lib/apiError";
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { authFetch } from "@/lib/api/authFetch";
import { useAuth } from "@/hooks/useAuth";
import { ShareModal } from "@/components/common/ShareModal";
import { StorePageHeader } from "@/components/store/StorePageHeader";
import { StoreTabsNav, type StoreTabKey } from "@/components/store/StoreTabsNav";
import { StoreOverviewTab } from "@/components/store/tabs/StoreOverviewTab";
import { StoreProductsTab } from "@/components/store/tabs/StoreProductsTab";
import { StoreCollectionsTab } from "@/components/store/tabs/StoreCollectionsTab";
import { StoreDesignTab } from "@/components/store/tabs/StoreDesignTab";
import { StoreSettingsTab } from "@/components/store/tabs/StoreSettingsTab";
import { Spinner as Loader2 } from "@/components/icons/rounded";
import type { Storefront, StorefrontLink } from "@/types/storefront";

const SITE_BASE = window.location.origin;

export function StoreManagementPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active tab state (synced with ?tab= query param if present)
  const tabParam = (searchParams.get('tab') as StoreTabKey) || 'overview';
  const [activeTab, setActiveTab] = useState<StoreTabKey>(
    ['overview', 'products', 'collections', 'design', 'settings'].includes(tabParam)
      ? tabParam
      : 'overview'
  );

  const handleTabChange = (newTab: StoreTabKey) => {
    setActiveTab(newTab);
    setSearchParams(newTab === 'overview' ? {} : { tab: newTab });
  };

  // Storefront backend state
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingPublish, setIsTogglingPublish] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form values
  const [displayName, setDisplayName] = useState('');
  const [tagline, setTagline] = useState('');
  const [bio, setBio] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [links, setLinks] = useState<StorefrontLink[]>([]);

  // Catalog counts for Overview cards
  const [digitalCount, setDigitalCount] = useState(0);
  const [physicalCount, setPhysicalCount] = useState(0);
  const [collectionsCount, setCollectionsCount] = useState(0);

  // Fetch Storefront data


  useEffect(() => {
    // Cleared on cleanup, so a response from an older run or an unmounted page is dropped.
    let active = true;
    (async () => {
      try {
        const res = await authFetch(`/storefront`, {
          headers: {
            Accept: 'application/json',
          },
        });
        if (res.ok && active) {
          const json = await res.json();
          const data: Storefront = json.data?.data ?? json.data;
          setStorefront(data);
          setDisplayName(data.display_name ?? user?.name ?? '');
          setTagline(data.tagline ?? 'Welcome to my official creator storefront.');
          setBio(data.bio ?? 'Explore my digital products, community memberships, and exclusive content.');
          setShortCode(data.short_code ?? user?.username ?? `user-${user?.id}`);
          setCoverUrl(data.cover_url ?? '');
          setAvatarUrl(data.avatar_url ?? user?.avatar_url ?? '');
          setLinks(Array.isArray(data.links) ? data.links : []);
        }
      } catch {
        if (active) setError('Failed to load storefront data.');
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    // Fetch summary counts (digital products, physical products, collections)
    (async () => {
      try {
        const [digRes, physRes, colRes] = await Promise.allSettled([
          authFetch(`/store/products?per_page=1`, {
            headers: { Accept: 'application/json', },
          }),
          authFetch(`/store/physical-products/my?per_page=1`, {
            headers: { Accept: 'application/json', },
          }),
          authFetch(`/store/categories`, {
            headers: { Accept: 'application/json', },
          }),
        ]);

        if (digRes.status === 'fulfilled' && digRes.value.ok) {
          const j = await digRes.value.json();
          const total = j?.data?.total ?? (Array.isArray(j?.data?.data) ? j.data.data.length : 0);
          if (active) setDigitalCount(Number(total) || 0);
        }

        if (physRes.status === 'fulfilled' && physRes.value.ok) {
          const j = await physRes.value.json();
          const total = j?.data?.total ?? j?.total ?? (Array.isArray(j?.data) ? j.data.length : 0);
          if (active) setPhysicalCount(Number(total) || 0);
        }

        if (colRes.status === 'fulfilled' && colRes.value.ok) {
          const j = await colRes.value.json();
          const list = j?.data ?? j;
          if (active) setCollectionsCount(Array.isArray(list) ? list.length : 0);
        }
      } catch (e) {
        logger.warn('Could not fetch store counts', e);
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.id, user?.name, user?.username, user?.avatar_url]);

  // Unified save method
  const handleSaveStorefront = async (overrides?: Partial<{
    displayName: string;
    tagline: string;
    bio: string;
    shortCode: string;
    coverUrl: string;
    avatarUrl: string;
    links: StorefrontLink[];
  }>): Promise<boolean> => {
    setIsSaving(true);
    setError(null);

    const payload = {
      display_name: overrides?.displayName ?? displayName,
      tagline: overrides?.tagline ?? tagline,
      bio: overrides?.bio ?? bio,
      short_code: overrides?.shortCode ?? shortCode,
      cover_url: overrides?.coverUrl !== undefined ? overrides.coverUrl || null : coverUrl || null,
      avatar_url: overrides?.avatarUrl !== undefined ? overrides.avatarUrl || null : avatarUrl || null,
      links: (overrides?.links ?? links).filter((l) => l.label.trim() && l.url.trim()),
    };

    try {
      const res = await authFetch(`/storefront`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Save failed.');

      const saved = json.data?.data ?? json.data;
      setStorefront(saved);
      if (overrides?.displayName) setDisplayName(overrides.displayName);
      if (overrides?.tagline !== undefined) setTagline(overrides.tagline);
      if (overrides?.bio !== undefined) setBio(overrides.bio);
      if (overrides?.shortCode) setShortCode(overrides.shortCode);
      if (overrides?.coverUrl !== undefined) setCoverUrl(overrides.coverUrl);
      if (overrides?.avatarUrl !== undefined) setAvatarUrl(overrides.avatarUrl);
      if (overrides?.links) setLinks(overrides.links);

      return true;
    } catch (err: unknown) {
      const apiErr = asApiError(err);
      setError(err instanceof Error ? apiErr.message : 'An error occurred while saving.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle publish state
  const handleTogglePublish = async () => {
    if (!storefront) return;
    setIsTogglingPublish(true);

    const nextState = !storefront.is_published;

    try {
      const res = await authFetch(`/storefront/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ is_published: nextState }),
      });

      if (res.ok) {
        const json = await res.json();
        setStorefront(json.data?.data ?? json.data);
      } else {
        const json = await res.json().catch(() => null);
        setError(json?.message || 'Failed to update store publish status.');
      }
    } catch (e) {
      logger.error('Failed to toggle publish', e);
      setError(e instanceof Error ? e.message : 'Network error updating store publish status.');
    } finally {
      setIsTogglingPublish(false);
    }
  };

  const publicUrl = `${SITE_BASE}/store/${shortCode}`;

  const userInitials =
    (displayName || user?.name || 'VI')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  if (isLoading) {
    return (
      <div className="py-28 text-center space-y-3">
        <Loader2 weight="fill" className="h-8 w-8 animate-spin text-[var(--shell-accent)] mx-auto" />
        <p className="text-xs text-[var(--shell-muted)] font-medium">Loading store dashboard…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-7 space-y-6">
      {/* 1. Store Header matching reference */}
      <StorePageHeader
        isPublished={Boolean(storefront?.is_published)}
        isTogglingPublish={isTogglingPublish}
        onTogglePublish={handleTogglePublish}
        onShare={() => setShowShareModal(true)}
        shortCode={shortCode}
      />

      {/* 2. Primary 5-Tab Navigation Bar */}
      <StoreTabsNav activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Global Error Banner */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* 3. Tab Contents */}
      {activeTab === 'overview' && (
        <StoreOverviewTab
          displayName={displayName}
          shortCode={shortCode}
          tagline={tagline}
          bio={bio}
          coverUrl={coverUrl}
          avatarUrl={avatarUrl}
          userInitials={userInitials}
          publicUrl={publicUrl}
          links={links}
          digitalCount={digitalCount}
          physicalCount={physicalCount}
          collectionsCount={collectionsCount}
          isSaving={isSaving}
          onSaveIdentity={async (data) => {
            const ok = await handleSaveStorefront({
              displayName: data.displayName,
              shortCode: data.shortCode,
              tagline: data.tagline,
              bio: data.bio,
            });
            return ok;
          }}
          onCoverChange={async (url) => {
            const prev = coverUrl;
            setCoverUrl(url);
            const ok = await handleSaveStorefront({ coverUrl: url });
            if (!ok) setCoverUrl(prev);
          }}
          onAvatarChange={async (url) => {
            const prev = avatarUrl;
            setAvatarUrl(url);
            const ok = await handleSaveStorefront({ avatarUrl: url });
            if (!ok) setAvatarUrl(prev);
          }}
          onSaveLinks={async (newLinks) => {
            setLinks(newLinks);
            return await handleSaveStorefront({ links: newLinks });
          }}
          onNavigateTab={handleTabChange}
        />
      )}

      {activeTab === 'products' && <StoreProductsTab />}

      {activeTab === 'collections' && <StoreCollectionsTab />}

      {activeTab === 'design' && (
        <StoreDesignTab
          displayName={displayName}
          shortCode={shortCode}
          tagline={tagline}
          bio={bio}
          coverUrl={coverUrl}
          avatarUrl={avatarUrl}
          userInitials={userInitials}
          publicUrl={publicUrl}
          onCoverChange={(url) => setCoverUrl(url)}
          onAvatarChange={(url) => setAvatarUrl(url)}
          onSaveAll={async () => {
            await handleSaveStorefront({ coverUrl, avatarUrl });
          }}
          isSaving={isSaving}
        />
      )}

      {activeTab === 'settings' && (
        <StoreSettingsTab
          displayName={displayName}
          shortCode={shortCode}
          tagline={tagline}
          bio={bio}
          isPublished={Boolean(storefront?.is_published)}
          publicUrl={publicUrl}
          onSave={async (data) => {
            return await handleSaveStorefront({
              displayName: data.displayName,
              shortCode: data.shortCode,
              tagline: data.tagline,
              bio: data.bio,
            });
          }}
          onTogglePublish={handleTogglePublish}
          isSaving={isSaving}
          isTogglingPublish={isTogglingPublish}
        />
      )}

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          title={displayName || 'Creator Store'}
          url={publicUrl}
          description={tagline || 'Check out my store on MurihSpace!'}
        />
      )}
    </div>
  );
}
export default StoreManagementPage;

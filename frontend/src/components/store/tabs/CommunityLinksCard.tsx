import { safeHref } from "@/lib/safeUrl";
import React, { useState } from 'react';
import { Plus, Delete as Trash, Discovery as Globe } from '@/components/icons';
import { LinkSimple, ArrowSquareOut } from '@/components/icons/rounded';
import { Button } from '@/components/ui/button';
import type { StorefrontLink } from '@/types/storefront';

interface CommunityLinksCardProps {
  links: StorefrontLink[];
  onSaveLinks: (links: StorefrontLink[]) => Promise<boolean>;
}

export const CommunityLinksCard: React.FC<CommunityLinksCardProps> = ({
  links,
  onSaveLinks,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newLabel.trim()) {
      setError('Label is required (e.g. YouTube, Twitter).');
      return;
    }
    let formattedUrl = newUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    try {
      new URL(formattedUrl);
    } catch {
      setError('Please provide a valid web address (URL).');
      return;
    }

    setIsSubmitting(true);
    const updated = [...links, { label: newLabel.trim(), url: formattedUrl }];
    const success = await onSaveLinks(updated);
    setIsSubmitting(false);

    if (success) {
      setNewLabel('');
      setNewUrl('');
      setShowAddModal(false);
    } else {
      setError('Failed to save link. Please try again.');
    }
  };

  const handleDeleteLink = async (index: number) => {
    const updated = links.filter((_, i) => i !== index);
    await onSaveLinks(updated);
  };

  return (
    <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-5 sm:p-6 transition-all shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left Side: Title & Description */}
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-[var(--shell-accent-solid)]/10 border border-[var(--shell-accent)]/20 flex items-center justify-center text-[var(--shell-accent)] shrink-0">
            <LinkSimple className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Community & links</h3>
            <p className="text-xs text-[var(--shell-muted)] mt-0.5">
              Add your social media, website, or other external links for your buyers.
            </p>
          </div>
        </div>

        {/* Right Side: Empty state preview or items count & Add Link Button */}
        <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
          {links.length === 0 ? (
            <div className="flex items-center gap-3 text-left">
              <div className="h-9 w-9 rounded-full bg-[var(--shell-surface)] border border-[var(--shell-border)] flex items-center justify-center text-[var(--shell-muted)] shrink-0">
                <Globe className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">No external links added yet.</p>
                <p className="text-[11px] text-[var(--shell-muted)]">
                  Add Twitter, YouTube, or portfolio links for your store visitors.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {links.map((link, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--shell-surface)] border border-[var(--shell-border)] text-xs text-white"
                >
                  <a
                    href={safeHref(link.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#087FFF] flex items-center gap-1 font-medium transition-colors"
                  >
                    {link.label}
                    <ArrowSquareOut className="h-3 w-3 text-[var(--shell-muted)]" />
                  </a>
                  <button
                    onClick={() => handleDeleteLink(idx)}
                    type="button"
                    className="ml-1 text-[var(--shell-muted)] hover:text-red-400 transition-colors"
                    title="Remove link"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="h-9 px-3.5 text-xs font-semibold rounded-lg bg-[var(--shell-surface)] hover:bg-[var(--shell-hover-strong)] text-white border border-[var(--shell-border)] transition-all gap-1.5 shrink-0"
          >
            <Plus className="h-3.5 w-3.5 text-[var(--shell-accent)]" />
            Add link
          </Button>
        </div>
      </div>

      {/* Add Link Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--shell-border)]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <LinkSimple className="h-4 w-4 text-[var(--shell-accent)]" />
                Add External Link
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[var(--shell-muted)] hover:text-white text-xs font-medium"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleAddLink} className="space-y-4">
              <div>
                <label htmlFor="f-re-tabs-communitylinkscard-tsx-155" className="block text-xs font-semibold text-[var(--shell-muted)] mb-1">
                  Platform or Title
                </label>
                <input id="f-re-tabs-communitylinkscard-tsx-155"
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. YouTube, Twitter, Portfolio"
                  className="w-full bg-[var(--shell-canvas)] border border-[var(--shell-border)] rounded-xl px-3.5 py-2 text-sm text-white placeholder-[var(--shell-muted)] focus:outline-none focus:border-[var(--shell-accent)]"
                />
              </div>

              <div>
                <label htmlFor="f-re-tabs-communitylinkscard-tsx-168" className="block text-xs font-semibold text-[var(--shell-muted)] mb-1">
                  Destination URL
                </label>
                <input id="f-re-tabs-communitylinkscard-tsx-168"
                  type="text"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[var(--shell-canvas)] border border-[var(--shell-border)] rounded-xl px-3.5 py-2 text-sm text-white placeholder-[var(--shell-muted)] focus:outline-none focus:border-[var(--shell-accent)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                  className="bg-[var(--shell-surface)] border-[var(--shell-border)] text-[var(--shell-muted)] hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-[var(--shell-accent-solid)] hover:bg-[var(--shell-accent-hover)] text-white font-bold"
                >
                  {isSubmitting ? 'Saving…' : 'Add Link'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


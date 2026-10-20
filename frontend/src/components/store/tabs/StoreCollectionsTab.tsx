import { logger } from "@/lib/logger";
import { asApiError } from "@/lib/apiError";
import React, { useState, useEffect } from 'react';
import { authFetch } from '@/lib/api/authFetch';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/DialogProvider';
import { Plus, Edit, Delete as Trash2, Folder } from '@/components/icons';
import { Spinner } from '@/components/icons/rounded';

interface Collection {
  id: number;
  name: string;
  slug: string;
  products_count?: number;
  created_at?: string;
}

export const StoreCollectionsTab: React.FC = () => {
  const confirm = useConfirm();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fetchCollectionsKey, setFetchCollectionsKey] = useState(0);
  const fetchCollections = () => {
    setLoading(true);
    setFetchCollectionsKey((k) => k + 1);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await authFetch('/store/categories', {
          headers: { Accept: 'application/json', },
        });
        if (res.ok) {
          const j = await res.json();
          const data = j?.data ?? j;
          if (active) setCollections(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        logger.error('Failed to load collections', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchCollectionsKey]);


  const handleOpenAdd = () => {
    setEditing(null);
    setName('');
    setError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (col: Collection) => {
    setEditing(col);
    setName(col.name);
    setError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const res = editing
        ? await authFetch(`/store/categories/${editing.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({ name: name.trim() }),
          })
        : await authFetch('/store/categories', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({ name: name.trim() }),
          });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? 'Save failed.');
      }

      setShowModal(false);
      setName('');
      setEditing(null);
      fetchCollections();
    } catch (err: unknown) {
      const apiErr = asApiError(err);
      setError(err instanceof Error ? apiErr.message : 'Error saving collection.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (col: Collection) => {
    if (
      !(await confirm({
        title: 'Delete Collection',
        message: `Are you sure you want to delete collection "${col.name}"? Products inside will remain unaffected.`,
        variant: 'destructive',
      }))
    )
      return;

    await authFetch(`/store/categories/${col.id}`, {
      method: 'DELETE',
      headers: { },
    });
    fetchCollections();
  };

  return (
    <div className="space-y-6 pt-2">
      {/* Header bar */}
      <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Folder className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Store Collections</h3>
            <p className="text-xs text-[var(--shell-muted)] mt-0.5">
              Group your products into collections (e.g. Featured, Summer Drops, Tutorials).
            </p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={handleOpenAdd}
          className="h-9 px-4 text-xs font-bold rounded-xl bg-[var(--shell-accent-solid)] hover:bg-[var(--shell-accent-hover)] text-white flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Add Collection
        </Button>
      </div>

      {/* Grid of collections */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <Spinner weight="bold" className="h-7 w-7 animate-spin text-[var(--shell-accent)] mx-auto" />
          <p className="text-xs text-[var(--shell-muted)]">Loading collections…</p>
        </div>
      ) : collections.length === 0 ? (
        <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-12 text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-[var(--shell-surface)] border border-[var(--shell-border)] flex items-center justify-center text-[var(--shell-muted)] mx-auto">
            <Folder className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">No collections created yet</p>
            <p className="text-xs text-[var(--shell-muted)] mt-0.5 max-w-sm mx-auto">
              Organize your items into curated collections so buyers can find what they want faster.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="mt-2 bg-[var(--shell-accent-solid)] hover:bg-[var(--shell-accent-hover)] text-white text-xs font-bold rounded-xl"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Create Collection
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((col) => (
            <div
              key={col.id}
              className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-5 hover:border-[#087FFF]/40 transition-all flex flex-col justify-between space-y-4 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <Folder className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{col.name}</h4>
                    <p className="text-[11px] text-[var(--shell-muted)] mt-0.5 font-mono">
                      /{col.slug}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--shell-border)]/60 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleOpenEdit(col)}
                  className="p-1.5 rounded-lg text-[var(--shell-muted)] hover:text-white hover:bg-[var(--shell-hover)] transition-colors"
                  title="Edit collection"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(col)}
                  className="p-1.5 rounded-lg text-[var(--shell-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete collection"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Collection Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--shell-border)]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Folder className="h-4 w-4 text-[var(--shell-accent)]" />
                {editing ? 'Edit Collection' : 'New Collection'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
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

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="f-e-tabs-storecollectionstab-tsx-246" className="block text-xs font-semibold text-[var(--shell-muted)] mb-1">
                  Collection Name
                </label>
                <input id="f-e-tabs-storecollectionstab-tsx-246"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Masterclass Series, Summer Merch"
                  required
                  className="w-full bg-[var(--shell-canvas)] border border-[var(--shell-border)] rounded-xl px-3.5 py-2 text-sm text-white placeholder-[var(--shell-muted)] focus:outline-none focus:border-[var(--shell-accent)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowModal(false)}
                  className="bg-[var(--shell-surface)] border-[var(--shell-border)] text-[var(--shell-muted)] hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving}
                  className="bg-[var(--shell-accent-solid)] hover:bg-[var(--shell-accent-hover)] text-white font-bold"
                >
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Collection'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


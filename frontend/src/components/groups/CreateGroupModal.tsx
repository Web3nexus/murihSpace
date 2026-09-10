import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Globe,
  Lock,
  ShieldCheck,
  UsersThree,
} from "@phosphor-icons/react";
import { apiClient } from "@/lib/api/client";
import { ImageUploader } from "@/components/upload/ImageUploader";
import type { Group, GroupPrivacy } from "@/types/group";

interface CreateGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (group: Group) => void;
}

const CATEGORIES = [
  "General",
  "Technology",
  "Creative & Art",
  "Business & Career",
  "Gaming",
  "Education & Study",
  "Fitness & Health",
  "Music & Media",
  "Lifestyle & Hobbies",
];

export function CreateGroupModal({
  open,
  onOpenChange,
  onCreated,
}: CreateGroupModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("General");
  const [privacy, setPrivacy] = React.useState<GroupPrivacy>("public");
  const [description, setDescription] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState("");
  const [coverUrl, setCoverUrl] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [rules, setRules] = React.useState("");
  const [tagsInput, setTagsInput] = React.useState("");

  const resetForm = () => {
    setName("");
    setCategory("General");
    setPrivacy("public");
    setDescription("");
    setAvatarUrl("");
    setCoverUrl("");
    setLocation("");
    setRules("");
    setTagsInput("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a group name.");
      return;
    }

    setLoading(true);
    setError(null);

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const res = await apiClient.post("/groups", {
        name: name.trim(),
        category,
        privacy,
        discoverability: privacy === "invite_only" ? "hidden" : "discoverable",
        description: description.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
        cover_url: coverUrl.trim() || undefined,
        location: location.trim() || undefined,
        rules: rules.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
      });

      const newGroup = res.data?.data;
      resetForm();
      onOpenChange(false);
      if (newGroup) {
        onCreated(newGroup);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to create group. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
        <DialogHeader className="space-y-1 text-left">
          <div className="flex items-center gap-2 text-primary">
            <UsersThree weight="fill" className="h-6 w-6" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              New Community Space
            </span>
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight">
            Create a Group
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Build a focused space for discussion, real-time group chat, and shared updates.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Group Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="group-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Group Name *
              </Label>
              <Input
                id="group-name"
                placeholder="e.g. Lagos Tech Founders"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
                className="h-11 rounded-xl bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="group-category" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Category
              </Label>
              <select
                id="group-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-11 rounded-xl bg-background border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Privacy Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Privacy Level
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setPrivacy("public")}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  privacy === "public"
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border/70 hover:border-border bg-card/50"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Globe weight="fill" className={`h-4 w-4 ${privacy === "public" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="font-semibold text-sm">Public</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Anyone can find, join, and read feed posts.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPrivacy("private")}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  privacy === "private"
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border/70 hover:border-border bg-card/50"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Lock weight="fill" className={`h-4 w-4 ${privacy === "private" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="font-semibold text-sm">Private</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Discoverable, but members must be approved.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPrivacy("invite_only")}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  privacy === "invite_only"
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border/70 hover:border-border bg-card/50"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <ShieldCheck weight="fill" className={`h-4 w-4 ${privacy === "invite_only" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="font-semibold text-sm">Invite Only</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Hidden from search. Join only with invite link.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="group-desc" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              About This Group
            </Label>
            <Textarea
              id="group-desc"
              placeholder="What is this group about? Who is it for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              className="rounded-xl resize-none bg-background border-border"
            />
          </div>

          {/* Visuals: Avatar & Cover Uploads */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Group Avatar (Icon / Logo)
              </Label>
              <ImageUploader
                value={avatarUrl}
                onChange={(url) => setAvatarUrl(url)}
                folder="groups/avatars"
                label="Upload Group Avatar"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Group Cover Banner
              </Label>
              <ImageUploader
                value={coverUrl}
                onChange={(url) => setCoverUrl(url)}
                folder="groups/covers"
                label="Upload Cover Banner"
              />
            </div>
          </div>

          {/* Tags & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="group-tags" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tags (comma separated)
              </Label>
              <Input
                id="group-tags"
                placeholder="ai, startup, react, founders"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="h-10 rounded-xl bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="group-loc" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Location / Region (optional)
              </Label>
              <Input
                id="group-loc"
                placeholder="e.g. Lagos, Nigeria or Global"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="h-10 rounded-xl bg-background border-border"
              />
            </div>
          </div>

          {/* Group Rules */}
          <div className="space-y-2">
            <Label htmlFor="group-rules" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Group Guidelines & Rules
            </Label>
            <Textarea
              id="group-rules"
              placeholder="1. Be respectful to fellow members&#10;2. No spam or self-promotion without permission&#10;3. Keep discussions relevant"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={3}
              className="rounded-xl resize-none bg-background border-border"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="rounded-xl px-6 bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
            >
              {loading ? "Creating Group..." : "Create Group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

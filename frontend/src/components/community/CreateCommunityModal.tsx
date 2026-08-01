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

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, Lock, Globe, DollarSign, Plus, Trash2, Users } from "lucide-react";
import type { Community, CreateCommunityInput } from "@/types/community";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { getAuthToken } from "@/lib/auth/token";

interface CreateCommunityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (community: Community) => void;
}

const CATEGORIES = [
  "Technology",
  "Art & Design",
  "Business",
  "Gaming",
  "Education",
  "Lifestyle",
  "Fitness",
  "General",
];

export function CreateCommunityModal({
  open,
  onOpenChange,
  onCreated,
}: CreateCommunityModalProps) {
  const [formData, setFormData] = React.useState<CreateCommunityInput>({
    name: "",
    description: "",
    category: "Technology",
    visibility: "public",
    pricing_type: "free",
    price_amount: 0,
    logo_url: "",
    cover_url: "",
    rules: [
      "Be respectful and supportive to all community members.",
      "No spam, self-promotion, or unauthorized link dumping.",
      "Engage constructively and share valuable insights.",
    ],
  });

  const [newRule, setNewRule] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleSlugPreview = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleAddRule = () => {
    if (!newRule.trim()) return;
    setFormData((prev) => ({
      ...prev,
      rules: [...(prev.rules || []), newRule.trim()],
    }));
    setNewRule("");
  };

  const handleRemoveRule = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      rules: (prev.rules || []).filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Community name is required.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/my-communities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to create community.");
      }

      onCreated(data.community);
      onOpenChange(false);
      // Reset form
      setFormData({
        name: "",
        description: "",
        category: "Technology",
        visibility: "public",
        pricing_type: "free",
        price_amount: 0,
        logo_url: "",
        cover_url: "",
        rules: [
          "Be respectful and supportive to all community members.",
          "No spam, self-promotion, or unauthorized link dumping.",
          "Engage constructively and share valuable insights.",
        ],
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 sm:p-8">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Create a New Community</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Set up your community space for members, events, and monetization.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 mt-2">
          {/* Community Name & Slug preview */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-semibold">
              Community Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g. Murih Creators Hub"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-11 text-base"
              maxLength={100}
              required
            />
            {formData.name && (
              <p className="text-xs text-muted-foreground font-mono">
                URL Preview: <span className="text-secondary font-semibold">app.murihspace.com/communities/{handleSlugPreview(formData.name)}</span>
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-semibold">
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Tell members what this community is about..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="resize-none text-sm"
              maxLength={1000}
            />
          </div>

          {/* Category & Visibility Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(val) => setFormData({ ...formData, category: val })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Access Visibility</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, visibility: "public" })}
                  className={`flex items-center justify-center gap-2 h-11 rounded-lg border text-xs font-semibold transition-all ${
                    formData.visibility === "public"
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Globe className="h-4 w-4" />
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, visibility: "private" })}
                  className={`flex items-center justify-center gap-2 h-11 rounded-lg border text-xs font-semibold transition-all ${
                    formData.visibility === "private"
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Lock className="h-4 w-4" />
                  Private
                </button>
              </div>
            </div>
          </div>

          {/* Pricing Model */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Membership Model</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, pricing_type: "free" })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  formData.pricing_type === "free"
                    ? "border-primary bg-accent/30 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <p className="font-semibold text-sm">Free Community</p>
                <p className="text-xs text-muted-foreground mt-0.5">Anyone can join without payment.</p>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, pricing_type: "paid" })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  formData.pricing_type === "paid"
                    ? "border-primary bg-accent/30 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <p className="font-semibold text-sm">Paid Access</p>
                <p className="text-xs text-muted-foreground mt-0.5">Charge a one-off or monthly fee.</p>
              </button>
            </div>

            {formData.pricing_type === "paid" && (
              <div className="mt-3 space-y-1.5 animate-fade-in">
                <Label htmlFor="price" className="text-xs font-semibold">
                  Price ($ USD)
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="price"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="19.99"
                    value={formData.price_amount || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, price_amount: parseFloat(e.target.value) || 0 })
                    }
                    className="pl-9 h-10 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Logo & Cover image URLs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Logo</Label>
              <ImageUploader
                value={formData.logo_url || ""}
                onChange={(url) => setFormData({ ...formData, logo_url: url })}
                folder="communities/logos"
                label=""
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Cover Image</Label>
              <ImageUploader
                value={formData.cover_url || ""}
                onChange={(url) => setFormData({ ...formData, cover_url: url })}
                folder="communities/covers"
                label=""
              />
            </div>
          </div>

          {/* Community Rules */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Community Guidelines / Rules</Label>
            <div className="space-y-2">
              {formData.rules?.map((rule, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border bg-muted/40 text-xs font-medium"
                >
                  <span className="flex-1">
                    <span className="text-secondary font-bold mr-2">{idx + 1}.</span>
                    {rule}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRule(idx)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Add a new guideline..."
                value={newRule}
                onChange={(e) => setNewRule(e.target.value)}
                className="h-9 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddRule();
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddRule} className="h-9 gap-1.5 text-xs shrink-0">
                <Plus className="h-3.5 w-3.5" />
                Add Rule
              </Button>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Publish Community
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

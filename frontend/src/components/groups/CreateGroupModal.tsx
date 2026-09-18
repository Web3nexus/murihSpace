import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
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
  Sparkle,
  Image as ImageIcon,
  MapPin,
  Tag,
  ArrowRight,
  ArrowLeft,
  Eye,
  Check,
  BookOpen,
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
  { label: "Technology & Code", id: "Technology", icon: "💻" },
  { label: "Creative & Design", id: "Creative & Art", icon: "🎨" },
  { label: "Business & Career", id: "Business & Career", icon: "💼" },
  { label: "Gaming & Esports", id: "Gaming", icon: "🎮" },
  { label: "Education & Study", id: "Education & Study", icon: "📚" },
  { label: "Health & Fitness", id: "Fitness & Health", icon: "⚡" },
  { label: "Music & Media", id: "Music & Media", icon: "🎵" },
  { label: "Lifestyle & Hobbies", id: "Lifestyle & Hobbies", icon: "🌱" },
  { label: "General Discussion", id: "General", icon: "💬" },
];

const PRESET_RULES = [
  "Be respectful and supportive of all members.",
  "No spam, unsolicited promotions, or affiliate links.",
  "Keep discussions relevant to the group's theme.",
  "Constructive feedback is welcomed; harassment is zero tolerance.",
];

export function CreateGroupModal({
  open,
  onOpenChange,
  onCreated,
}: CreateGroupModalProps) {
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Form Fields
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("Technology");
  const [privacy, setPrivacy] = React.useState<GroupPrivacy>("public");
  const [description, setDescription] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState("");
  const [coverUrl, setCoverUrl] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [rules, setRules] = React.useState("");
  const [tagsInput, setTagsInput] = React.useState("");
  const [showPreviewMobile, setShowPreviewMobile] = React.useState(false);

  const resetForm = () => {
    setStep(1);
    setName("");
    setCategory("Technology");
    setPrivacy("public");
    setDescription("");
    setAvatarUrl("");
    setCoverUrl("");
    setLocation("");
    setRules("");
    setTagsInput("");
    setError(null);
  };

  const handleApplyPresetRule = (rule: string) => {
    setRules((prev) => {
      const clean = prev.trim();
      if (!clean) return rule;
      if (clean.includes(rule)) return clean;
      return `${clean}\n• ${rule}`;
    });
  };

  // Safe slug generator for preview
  const previewSlug = React.useMemo(() => {
    if (!name.trim()) return "your-community";
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }, [name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setStep(1);
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

      // Safely unwrap response across single or double enveloped structures
      const raw = res.data;
      const newGroup: Group | null =
        raw?.data?.data && typeof raw.data.data === "object" && raw.data.data.slug
          ? raw.data.data
          : raw?.data && typeof raw.data === "object" && raw.data.slug
          ? raw.data
          : raw?.group && typeof raw.group === "object" && raw.group.slug
          ? raw.group
          : raw?.slug
          ? raw
          : null;

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
      <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-3xl border-border/70 shadow-2xl bg-background">
        {/* Header Ribbon */}
        <div className="relative bg-gradient-to-r from-primary/15 via-primary/5 to-transparent px-6 sm:px-8 pt-6 pb-5 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
              <span className="flex items-center justify-center h-6 w-6 rounded-lg bg-primary/10 text-primary">
                <UsersThree weight="fill" className="h-4 w-4" />
              </span>
              <span>Community Studio</span>
            </div>

            {/* Mobile preview toggle */}
            <div className="sm:hidden">
              <button
                type="button"
                onClick={() => setShowPreviewMobile(!showPreviewMobile)}
                className="text-xs px-2.5 py-1 rounded-full border border-border bg-card font-medium flex items-center gap-1 text-muted-foreground"
              >
                <Eye className="h-3.5 w-3.5 text-primary" />
                {showPreviewMobile ? "Hide Card" : "Preview"}
              </button>
            </div>
          </div>

          <DialogTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-2">
            Create a Community Space
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1 max-w-xl">
            Launch a dedicated hub for group discussions, real-time chats, and community posts.
          </DialogDescription>

          {/* Step Progress Indicators */}
          <div className="flex items-center gap-2 pt-4">
            {[
              { num: 1, label: "Identity" },
              { num: 2, label: "Privacy" },
              { num: 3, label: "Visuals & Rules" },
            ].map((s) => (
              <button
                key={s.num}
                type="button"
                onClick={() => setStep(s.num as any)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  step === s.num
                    ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20"
                    : step > s.num
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] ${
                    step === s.num
                      ? "bg-primary-foreground text-primary font-bold"
                      : "bg-background/80"
                  }`}
                >
                  {step > s.num ? "✓" : s.num}
                </span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Studio Content: Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 max-h-[75vh] overflow-y-auto">
          {/* Main Form Fields (Left Column) */}
          <div className="lg:col-span-7 p-6 sm:p-8 space-y-6">
            {error && (
              <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive font-medium flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* STEP 1: IDENTITY & TOPIC */}
              {step === 1 && (
                <div className="space-y-5 animate-in fade-in-50 duration-200">
                  <div className="space-y-2">
                    <Label htmlFor="group-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Group Name *</span>
                      <span className="text-[10px] font-normal text-muted-foreground/80">
                        {name.length}/80 chars
                      </span>
                    </Label>
                    <Input
                      id="group-name"
                      placeholder="e.g. NextGen Web3 Founders"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={80}
                      required
                      autoFocus
                      className="h-12 text-base rounded-2xl bg-background border-border/80 focus-visible:ring-primary shadow-xs"
                    />
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                      <span>URL:</span>
                      <span className="text-primary font-semibold truncate">
                        murihspace.com/app/groups/{previewSlug}
                      </span>
                    </p>
                  </div>

                  {/* Category Pill Selector */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Select Primary Category
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCategory(c.id)}
                          className={`px-3 py-2 rounded-xl text-left text-xs font-medium border transition-all flex items-center gap-2 cursor-pointer ${
                            category === c.id
                              ? "border-primary bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary/30"
                              : "border-border/60 hover:border-border text-muted-foreground hover:text-foreground bg-card/40"
                          }`}
                        >
                          <span className="text-sm">{c.icon}</span>
                          <span className="truncate">{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="group-desc" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Description & Purpose
                    </Label>
                    <Textarea
                      id="group-desc"
                      placeholder="What is this group about? What discussions and activities can members look forward to?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      maxLength={1000}
                      className="rounded-2xl resize-none bg-background border-border/80 focus-visible:ring-primary text-sm p-3.5"
                    />
                  </div>

                  {/* Tags */}
                  <div className="space-y-2">
                    <Label htmlFor="group-tags" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-primary" />
                      <span>Search Tags (comma separated)</span>
                    </Label>
                    <Input
                      id="group-tags"
                      placeholder="founders, crypto, ai, startups, dev"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      className="h-11 rounded-2xl bg-background border-border/80 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: PRIVACY & MEMBERSHIP */}
              {step === 2 && (
                <div className="space-y-5 animate-in fade-in-50 duration-200">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Access & Privacy Level
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Control who can discover, view, and participate in your community.
                    </p>

                    <div className="space-y-3 pt-1">
                      {/* Public */}
                      <button
                        type="button"
                        onClick={() => setPrivacy("public")}
                        className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-4 ${
                          privacy === "public"
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                            : "border-border/70 hover:border-border bg-card/30"
                        }`}
                      >
                        <div className={`p-2.5 rounded-xl ${privacy === "public" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                          <Globe weight="fill" className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-foreground">Public Space</span>
                            {privacy === "public" && (
                              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                                ✓
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Open to all. Anyone can find, join, and participate in feed posts and chat.
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground font-medium">
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <Check className="h-3 w-3" /> Searchable
                            </span>
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <Check className="h-3 w-3" /> Instant Join
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Private */}
                      <button
                        type="button"
                        onClick={() => setPrivacy("private")}
                        className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-4 ${
                          privacy === "private"
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                            : "border-border/70 hover:border-border bg-card/30"
                        }`}
                      >
                        <div className={`p-2.5 rounded-xl ${privacy === "private" ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"}`}>
                          <Lock weight="fill" className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-foreground">Private (Moderated)</span>
                            {privacy === "private" && (
                              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                                ✓
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Discoverable in directory, but new members must submit a join request for admin approval.
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground font-medium">
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <Check className="h-3 w-3" /> Searchable
                            </span>
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <ShieldCheck className="h-3 w-3" /> Approval Required
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Invite Only */}
                      <button
                        type="button"
                        onClick={() => setPrivacy("invite_only")}
                        className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-4 ${
                          privacy === "invite_only"
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                            : "border-border/70 hover:border-border bg-card/30"
                        }`}
                      >
                        <div className={`p-2.5 rounded-xl ${privacy === "invite_only" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                          <ShieldCheck weight="fill" className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-foreground">Invite Only (Secret)</span>
                            {privacy === "invite_only" && (
                              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                                ✓
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Hidden from public discovery. Accessible strictly by private invite link.
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground font-medium">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              • Hidden from Search
                            </span>
                            <span className="flex items-center gap-1 text-primary">
                              • Exclusive Link Only
                            </span>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Location field */}
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="group-loc" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      <span>Community Region / Base (Optional)</span>
                    </Label>
                    <Input
                      id="group-loc"
                      placeholder="e.g. Lagos, Nigeria or Global Remote"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="h-11 rounded-2xl bg-background border-border/80 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: VISUALS & GUIDELINES */}
              {step === 3 && (
                <div className="space-y-5 animate-in fade-in-50 duration-200">
                  {/* Avatar & Cover Uploaders */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Group Logo / Avatar
                      </Label>
                      <ImageUploader
                        value={avatarUrl}
                        onChange={(url) => setAvatarUrl(url)}
                        folder="groups/avatars"
                        label="Upload Icon"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Cover Banner Image
                      </Label>
                      <ImageUploader
                        value={coverUrl}
                        onChange={(url) => setCoverUrl(url)}
                        folder="groups/covers"
                        label="Upload Banner"
                      />
                    </div>
                  </div>

                  {/* Rules & Guidelines */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="group-rules" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-primary" />
                        <span>Community Guidelines & Rules</span>
                      </Label>
                    </div>

                    {/* Preset chips */}
                    <div className="flex flex-wrap gap-1.5 py-1">
                      {PRESET_RULES.map((r, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleApplyPresetRule(r)}
                          className="text-[11px] px-2.5 py-1 rounded-full border border-border/80 bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                        >
                          + {r.split(" ")[0]} {r.split(" ")[1]} rule
                        </button>
                      ))}
                    </div>

                    <Textarea
                      id="group-rules"
                      placeholder="Write your expectations, code of conduct, and moderation guidelines here..."
                      value={rules}
                      onChange={(e) => setRules(e.target.value)}
                      rows={4}
                      className="rounded-2xl resize-none bg-background border-border/80 focus-visible:ring-primary text-sm p-3.5"
                    />
                  </div>
                </div>
              )}

              {/* Bottom Navigation Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-border/60">
                {step > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep((step - 1) as any)}
                    className="rounded-xl px-4 h-11 border-border/80 gap-1.5 text-xs font-semibold"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                    className="rounded-xl px-4 h-11 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </Button>
                )}

                {step < 3 ? (
                  <Button
                    type="button"
                    onClick={() => {
                      if (step === 1 && !name.trim()) {
                        setError("Please enter a group name.");
                        return;
                      }
                      setError(null);
                      setStep((step + 1) as any);
                    }}
                    className="rounded-xl px-6 h-11 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 gap-1.5 text-xs shadow-xs"
                  >
                    <span>Continue</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={loading || !name.trim()}
                    className="rounded-xl px-8 h-11 bg-primary text-primary-foreground font-bold hover:bg-primary/90 shadow-md gap-2 text-xs"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                        <span>Launching Group...</span>
                      </>
                    ) : (
                      <>
                        <Sparkle weight="fill" className="h-4 w-4 text-amber-300" />
                        <span>Create Community</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </div>

          {/* Right Column: Live Interactive Card Preview */}
          <div className="lg:col-span-5 bg-muted/30 border-l border-border/60 p-6 sm:p-8 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-primary" />
                  Live Directory Preview
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                  Real-time Card
                </span>
              </div>

              {/* Group Card Mockup */}
              <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-lg transition-all">
                {/* Cover Preview */}
                <div className="relative h-28 bg-gradient-to-r from-primary/30 via-secondary/20 to-primary/15 overflow-hidden">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt="Cover Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-primary/30">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}

                  {/* Category Pill */}
                  <div className="absolute top-3 right-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-background/90 backdrop-blur-md border border-border/80 text-foreground shadow-xs">
                      {category}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 relative pt-0">
                  {/* Floating Avatar */}
                  <div className="relative -mt-10 mb-3 flex items-end justify-between">
                    <div className="h-16 w-16 rounded-2xl border-4 border-card bg-background overflow-hidden shadow-md flex items-center justify-center font-bold text-xl text-primary flex-shrink-0">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Avatar Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UsersThree weight="fill" className="h-8 w-8 text-primary/70" />
                      )}
                    </div>

                    {/* Privacy Badge */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border/70">
                      {privacy === "public" ? (
                        <>
                          <Globe className="h-3 w-3 text-emerald-500" /> Public
                        </>
                      ) : privacy === "private" ? (
                        <>
                          <Lock className="h-3 w-3 text-amber-500" /> Private
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-3 w-3 text-primary" /> Invite Only
                        </>
                      )}
                    </span>
                  </div>

                  {/* Group Title & Info */}
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-base text-foreground leading-snug truncate">
                      {name.trim() || "Untitled Community"}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {description.trim() ||
                        "A space dedicated to passionate discussions, networking, and community updates on MurihSpace."}
                    </p>
                  </div>

                  {/* Stats & Meta Footer */}
                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/60 text-xs text-muted-foreground font-medium">
                    <div className="flex items-center gap-1 text-foreground font-semibold">
                      <UsersThree className="h-4 w-4 text-primary" />
                      <span>1 Member (You)</span>
                    </div>

                    {location ? (
                      <span className="flex items-center gap-1 truncate max-w-[120px]">
                        <MapPin className="h-3 w-3" /> {location}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/80">Global</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Tips Callout */}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <Sparkle weight="fill" className="h-4 w-4 text-primary" />
                  <span>Community Launch Perks</span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  Every new group instantly gets real-time WebSocket chat rooms, an interactive community feed, and member moderation tools.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export default CreateGroupModal;

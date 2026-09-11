import { useState } from "react";
import {
  ShareNetwork,
  Copy,
  Check,
  QrCode,
  WhatsappLogo,
  TwitterLogo,
  FacebookLogo,
  LinkedinLogo,
  TelegramLogo,
  RedditLogo,
  EnvelopeSimple,
  LinkSimple,
  DownloadSimple,
  ArrowSquareOut,
  X as XIcon,
  Eye,
  Code
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  url: string;
  description?: string;
  type?: "profile" | "store" | "product";
  imageUrl?: string;
  badge?: string;
}

export function ShareModal({
  isOpen,
  onClose,
  title,
  url,
  description,
  type = "profile",
  imageUrl,
  badge,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"link" | "qr" | "embed">("link");

  if (!isOpen) return null;

  const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title,
          text: description || `Check out this ${type} on MurihSpace`,
          url: fullUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      handleCopy();
    }
  };

  const shareText = encodeURIComponent(description || `Check out ${title} on MurihSpace!`);
  const encodedUrl = encodeURIComponent(fullUrl);

  const socialLinks = [
    {
      name: "WhatsApp",
      icon: <WhatsappLogo weight="fill" className="h-5 w-5 text-emerald-500" />,
      bg: "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
      href: `https://api.whatsapp.com/send?text=${shareText}%20${encodedUrl}`,
    },
    {
      name: "X (Twitter)",
      icon: <TwitterLogo weight="fill" className="h-5 w-5 text-sky-500" />,
      bg: "bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400",
      href: `https://twitter.com/intent/tweet?text=${shareText}&url=${encodedUrl}`,
    },
    {
      name: "Facebook",
      icon: <FacebookLogo weight="fill" className="h-5 w-5 text-blue-600" />,
      bg: "bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      name: "Telegram",
      icon: <TelegramLogo weight="fill" className="h-5 w-5 text-sky-400" />,
      bg: "bg-sky-400/10 hover:bg-sky-400/20 text-sky-600 dark:text-sky-400",
      href: `https://t.me/share/url?url=${encodedUrl}&text=${shareText}`,
    },
    {
      name: "LinkedIn",
      icon: <LinkedinLogo weight="fill" className="h-5 w-5 text-blue-700" />,
      bg: "bg-blue-700/10 hover:bg-blue-700/20 text-blue-700 dark:text-blue-300",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      name: "Reddit",
      icon: <RedditLogo weight="fill" className="h-5 w-5 text-orange-500" />,
      bg: "bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400",
      href: `https://reddit.com/submit?url=${encodedUrl}&title=${shareText}`,
    },
    {
      name: "Email",
      icon: <EnvelopeSimple weight="fill" className="h-5 w-5 text-muted-foreground" />,
      bg: "bg-muted/80 hover:bg-muted text-foreground",
      href: `mailto:?subject=${encodeURIComponent(title)}&body=${shareText}%0A%0A${encodedUrl}`,
    },
  ];

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(fullUrl)}`;

  const embedCode = `<iframe src="${fullUrl}" width="100%" height="500" style="border:none;border-radius:12px;overflow:hidden;" title="${title}"></iframe>`;

  const handleCopyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleDownloadQr = () => {
    const link = document.createElement("a");
    link.href = qrImageUrl;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-qr.png`;
    link.target = "_blank";
    link.click();
  };

  const typeLabel = type === "store" ? "Storefront" : type === "product" ? "Product" : "Profile";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <div
        className="relative w-full max-w-lg rounded-2xl bg-card border border-border/80 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <ShareNetwork weight="fill" className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Share {typeLabel}</h3>
              <p className="text-[11px] text-muted-foreground">Share public link, social cards, or scan QR code</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          >
            <XIcon weight="bold" className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border/60 px-6 bg-muted/10 gap-6">
          <button
            onClick={() => setActiveTab("link")}
            className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "link"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <LinkSimple weight="bold" className="h-3.5 w-3.5" />
            Share & Channels
          </button>
          <button
            onClick={() => setActiveTab("qr")}
            className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "qr"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <QrCode weight="bold" className="h-3.5 w-3.5" />
            QR Code
          </button>
          <button
            onClick={() => setActiveTab("embed")}
            className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "embed"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Code weight="bold" className="h-3.5 w-3.5" />
            Embed Code
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Card Preview Snippet */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex items-center gap-3.5">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={title}
                className="w-14 h-14 rounded-xl object-cover border border-border/60 shrink-0 bg-background"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary font-black flex items-center justify-center text-lg shrink-0">
                {title.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-foreground truncate">{title}</h4>
                {badge && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-primary/15 text-primary">
                    {badge}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                {description || `${typeLabel} on MurihSpace`}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 font-mono mt-1">
                <span className="truncate">{fullUrl}</span>
              </div>
            </div>
            <a
              href={fullUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 transition-colors shrink-0"
              title="Open link in new tab"
            >
              <ArrowSquareOut weight="bold" className="h-4 w-4" />
            </a>
          </div>

          {activeTab === "link" && (
            <>
              {/* Copy URL Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Public {typeLabel} Link
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center px-3.5 py-2.5 rounded-xl bg-muted/60 border border-border font-mono text-xs text-foreground overflow-hidden">
                    <span className="truncate">{fullUrl}</span>
                  </div>
                  <Button
                    onClick={handleCopy}
                    className={`h-10 px-4 text-xs font-bold gap-1.5 rounded-xl transition-all ${
                      copied
                        ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                        : "bg-primary hover:bg-primary/90 text-primary-foreground"
                    }`}
                  >
                    {copied ? <Check weight="bold" className="h-4 w-4" /> : <Copy weight="bold" className="h-4 w-4" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>

              {/* Native Device Share (Mobile & Supported Browsers) */}
              {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
                <Button
                  onClick={handleNativeShare}
                  variant="outline"
                  className="w-full h-10 text-xs font-bold gap-2 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/5"
                >
                  <ShareNetwork weight="fill" className="h-4 w-4" />
                  Share via Device Menu
                </Button>
              )}

              {/* Social Channels */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Share directly to social apps
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {socialLinks.map((social) => (
                    <a
                      key={social.name}
                      href={social.href}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border border-border/40 transition-all gap-1 text-center ${social.bg}`}
                    >
                      {social.icon}
                      <span className="text-[10px] font-semibold leading-tight">{social.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === "qr" && (
            <div className="space-y-4 text-center">
              <p className="text-xs text-muted-foreground">
                Scan this QR code with any smartphone camera to immediately open this {typeLabel.toLowerCase()}.
              </p>
              <div className="p-5 bg-white rounded-2xl w-56 h-56 mx-auto flex items-center justify-center border border-border/60 shadow-lg">
                <img
                  src={qrImageUrl}
                  alt="QR Code"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button
                  onClick={handleDownloadQr}
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs font-bold gap-1.5 rounded-xl"
                >
                  <DownloadSimple weight="bold" className="h-4 w-4" />
                  Download Image
                </Button>
                <Button
                  onClick={handleCopy}
                  size="sm"
                  className="h-9 text-xs font-bold gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {copied ? <Check weight="bold" className="h-4 w-4" /> : <Copy weight="bold" className="h-4 w-4" />}
                  {copied ? "Link Copied!" : "Copy Link"}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "embed" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Embed this {typeLabel.toLowerCase()} card on your website, blog, or portfolio.
              </p>
              <div className="relative">
                <textarea
                  readOnly
                  value={embedCode}
                  rows={4}
                  className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl bg-muted/60 border border-border text-foreground outline-none resize-none"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleCopyEmbed}
                  className={`h-9 px-4 text-xs font-bold gap-1.5 rounded-xl ${
                    embedCopied
                      ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                      : "bg-primary hover:bg-primary/90 text-primary-foreground"
                  }`}
                >
                  {embedCopied ? <Check weight="bold" className="h-4 w-4" /> : <Copy weight="bold" className="h-4 w-4" />}
                  {embedCopied ? "Embed Code Copied!" : "Copy Embed Code"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border/60 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
            <Eye weight="fill" className="h-3.5 w-3.5 text-primary" />
            <span>Publicly accessible to everyone</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs font-semibold rounded-lg"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router";
import { resolveDeepLink, type DeepLinkTarget, type DeepLinkType } from "@/lib/deepLinks";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  VideoCamera,
  Broadcast,
  CalendarBlank,
  ShoppingBag,
  UsersThree,
  Storefront,
  User,
  ChatCircleText,
  ArrowSquareOut,
} from "@phosphor-icons/react";

interface ChatMessageContentProps {
  content: string;
  isMine?: boolean;
  className?: string;
}

interface LinkPreviewData {
  type: string;
  label?: string;
  title?: string;
  description?: string;
  url?: string;
  cover_url?: string;
  is_active?: boolean;
  price?: number | string;
  currency?: string;
  members_count?: number;
  host?: { name?: string; username?: string; avatar_url?: string };
}

// In-memory cache across message re-renders
const previewCache = new Map<string, LinkPreviewData | null>();

// Extract URLs from text
const URL_REGEX = /(https?:\/\/[^\s]+|murihspace:\/\/[^\s]+)/gi;

function getIconForType(type: DeepLinkType) {
  switch (type) {
    case "meeting":
      return VideoCamera;
    case "live":
      return Broadcast;
    case "event":
      return CalendarBlank;
    case "product":
      return ShoppingBag;
    case "community":
      return UsersThree;
    case "storefront":
      return Storefront;
    case "profile":
    case "linkInBio":
      return User;
    case "chat":
      return ChatCircleText;
    default:
      return ArrowSquareOut;
  }
}

function getDefaultLabel(type: DeepLinkType): string {
  switch (type) {
    case "meeting":
      return "Join Meeting";
    case "live":
      return "Watch Live";
    case "event":
      return "View Event";
    case "product":
      return "View Product";
    case "community":
      return "View Community";
    case "storefront":
      return "Visit Store";
    case "profile":
    case "linkInBio":
      return "View Profile";
    case "chat":
      return "Open Chat";
    default:
      return "Open Link";
  }
}

function getDefaultTitle(target: DeepLinkTarget): string {
  switch (target.type) {
    case "meeting":
      return `Meeting: ${target.identifier}`;
    case "live":
      return "Live Stream";
    case "event":
      return "MurihSpace Event";
    case "product":
      return "Product";
    case "community":
      return `Community: ${target.identifier}`;
    case "storefront":
      return `Store: ${target.identifier}`;
    case "profile":
      return `@${target.identifier}`;
    case "linkInBio":
      return `@${target.identifier}'s Bio`;
    default:
      return target.identifier || "MurihSpace Link";
  }
}

export function ChatMessageContent({ content, isMine = false, className }: ChatMessageContentProps) {
  // Extract the first MurihSpace deep link target for the preview card
  const { parts, deepLinkCandidate } = useMemo(() => {
    if (!content) return { parts: [], deepLinkCandidate: null };

    const rawParts: Array<{ type: "text" | "url"; value: string; target?: DeepLinkTarget }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let firstDeepLink: { url: string; target: DeepLinkTarget } | null = null;

    // Reset regex index
    URL_REGEX.lastIndex = 0;

    while ((match = URL_REGEX.exec(content)) !== null) {
      if (match.index > lastIndex) {
        rawParts.push({
          type: "text",
          value: content.slice(lastIndex, match.index),
        });
      }

      const url = match[0];
      const target = resolveDeepLink(url);

      if (target.type !== "unknown" && !firstDeepLink) {
        firstDeepLink = { url, target };
      }

      rawParts.push({
        type: "url",
        value: url,
        target: target.type !== "unknown" ? target : undefined,
      });

      lastIndex = match.index + url.length;
    }

    if (lastIndex < content.length) {
      rawParts.push({
        type: "text",
        value: content.slice(lastIndex),
      });
    }

    return { parts: rawParts, deepLinkCandidate: firstDeepLink };
  }, [content]);

  const [preview, setPreview] = useState<LinkPreviewData | null>(() => {
    if (!deepLinkCandidate) return null;
    return previewCache.get(deepLinkCandidate.url) ?? null;
  });

  useEffect(() => {
    if (!deepLinkCandidate) {
      setPreview(null);
      return;
    }

    const cached = previewCache.get(deepLinkCandidate.url);
    if (cached !== undefined) {
      setPreview(cached);
      return;
    }

    let isMounted = true;
    apiClient
      .get("/link-preview", { params: { url: deepLinkCandidate.url } })
      .then((res) => {
        if (!isMounted) return;
        const data = res.data?.data as LinkPreviewData | undefined;
        if (data) {
          previewCache.set(deepLinkCandidate.url, data);
          setPreview(data);
        } else {
          previewCache.set(deepLinkCandidate.url, null);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        previewCache.set(deepLinkCandidate.url, null);
      });

    return () => {
      isMounted = false;
    };
  }, [deepLinkCandidate?.url]);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Formatted Text with clickable URLs */}
      <p className="text-inherit leading-relaxed whitespace-pre-wrap break-words">
        {parts.map((part, idx) => {
          if (part.type === "text") {
            return <React.Fragment key={idx}>{part.value}</React.Fragment>;
          }

          if (part.target) {
            return (
              <Link
                key={idx}
                to={part.target.route}
                className={cn(
                  "underline underline-offset-2 font-medium hover:opacity-80 transition-opacity",
                  isMine ? "text-amber-200" : "text-[#2164b6] dark:text-[#7ab0ff]"
                )}
              >
                {part.value}
              </Link>
            );
          }

          return (
            <a
              key={idx}
              href={part.value}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "underline underline-offset-2 hover:opacity-80 transition-opacity",
                isMine ? "text-white/90" : "text-[#2164b6] dark:text-[#7ab0ff]"
              )}
            >
              {part.value}
            </a>
          );
        })}
      </p>

      {/* Embedded Actionable Deep-Link Card */}
      {deepLinkCandidate && (
        <DeepLinkCard
          target={deepLinkCandidate.target}
          preview={preview}
          isMine={isMine}
        />
      )}
    </div>
  );
}

interface DeepLinkCardProps {
  target: DeepLinkTarget;
  preview: LinkPreviewData | null;
  isMine: boolean;
}

function DeepLinkCard({ target, preview, isMine }: DeepLinkCardProps) {
  const IconComponent = getIconForType(target.type);
  const title = preview?.title || getDefaultTitle(target);
  const label = preview?.label || getDefaultLabel(target.type);
  const isLive = target.type === "live" && (preview?.is_active ?? true);
  const isMeeting = target.type === "meeting";

  return (
    <div
      className={cn(
        "rounded-xl p-3 border transition-all mt-2 max-w-sm",
        isMine
          ? "bg-white/10 border-white/20 text-white"
          : "bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "p-2 rounded-lg shrink-0 flex items-center justify-center",
            isLive
              ? "bg-rose-500/20 text-rose-500"
              : isMine
              ? "bg-white/20 text-white"
              : "bg-[#2164b6]/15 dark:bg-[#7ab0ff]/15 text-[#2164b6] dark:text-[#7ab0ff]"
          )}
        >
          <IconComponent weight="bold" className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isLive ? (
              <span className="inline-flex items-center gap-1 bg-rose-500 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                Live
              </span>
            ) : isMeeting ? (
              <span
                className={cn(
                  "inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                  isMine
                    ? "bg-white/20 text-white"
                    : "bg-[#2164b6]/10 text-[#2164b6] dark:bg-[#7ab0ff]/15 dark:text-[#7ab0ff]"
                )}
              >
                Meeting Room
              </span>
            ) : (
              <span
                className={cn(
                  "inline-flex items-center text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded capitalize",
                  isMine ? "bg-white/15 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                )}
              >
                {target.type}
              </span>
            )}

            {preview?.host?.name && (
              <span className="text-[11px] opacity-75 truncate">
                by {preview.host.name}
              </span>
            )}
          </div>

          <h4 className="font-semibold text-xs mt-1 truncate leading-tight">
            {title}
          </h4>

          {preview?.description && (
            <p className="text-[11px] opacity-75 line-clamp-2 mt-0.5 leading-snug">
              {preview.description}
            </p>
          )}

          {preview?.members_count !== undefined && preview.members_count > 0 && (
            <p className="text-[10px] opacity-70 mt-0.5">
              {preview.members_count} members
            </p>
          )}

          {preview?.price !== undefined && (
            <p className="text-xs font-bold text-amber-400 mt-0.5">
              {preview.currency || "$"} {preview.price}
            </p>
          )}
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-2.5 pt-2 border-t border-current/10">
        <Link
          to={target.route}
          className={cn(
            "w-full h-8 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]",
            isLive
              ? "bg-rose-500 hover:bg-rose-600 text-white"
              : isMine
              ? "bg-white hover:bg-white/90 text-slate-900"
              : "bg-[#2164b6] hover:bg-[#1a5196] text-white dark:bg-[#3b82f6] dark:hover:bg-[#2563eb]"
          )}
        >
          {label}
          <ArrowSquareOut weight="bold" className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

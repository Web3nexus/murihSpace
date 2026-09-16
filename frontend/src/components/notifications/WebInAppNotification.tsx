import React from 'react';
import { toast } from 'sonner';
import {
  Bell,
  PaperPlaneTilt,
  ChatTeardropText,
  Gift,
  Wallet,
  CheckCircle,
  X,
  ArrowRight,
  ShieldCheck,
  ShieldWarning,
  Trophy,
  Lightning,
} from '@phosphor-icons/react';

export interface WebNotificationData {
  id?: string | number;
  title?: string;
  message?: string;
  body?: string;
  senderName?: string;
  senderAvatar?: string;
  type?: string;
  isOfficial?: boolean;
  isVerified?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

const TYPE_ICONS: Record<string, { icon: React.ReactNode; bg: string; text: string; border: string }> = {
  official: {
    icon: <PaperPlaneTilt weight="fill" className="w-5 h-5 text-sky-400" />,
    bg: 'bg-sky-500/15',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
  },
  message: {
    icon: <ChatTeardropText weight="fill" className="w-5 h-5 text-indigo-400" />,
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
  },
  gift: {
    icon: <Gift weight="fill" className="w-5 h-5 text-pink-400" />,
    bg: 'bg-pink-500/15',
    text: 'text-pink-400',
    border: 'border-pink-500/30',
  },
  money: {
    icon: <Wallet weight="fill" className="w-5 h-5 text-emerald-400" />,
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  reaction: {
    icon: <Lightning weight="fill" className="w-5 h-5 text-amber-400" />,
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  security: {
    icon: <ShieldWarning weight="fill" className="w-5 h-5 text-rose-400" />,
    bg: 'bg-rose-500/15',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
  },
  verified: {
    icon: <ShieldCheck weight="fill" className="w-5 h-5 text-emerald-400" />,
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  award: {
    icon: <Trophy weight="fill" className="w-5 h-5 text-amber-400" />,
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  default: {
    icon: <Bell weight="fill" className="w-5 h-5 text-sky-400" />,
    bg: 'bg-sky-500/15',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
  },
};

function resolveTypeStyle(type?: string, isOfficial?: boolean) {
  if (isOfficial) return TYPE_ICONS.official;
  if (!type) return TYPE_ICONS.default;

  const t = type.toLowerCase();
  if (t.includes('gift')) return TYPE_ICONS.gift;
  if (t.includes('money') || t.includes('transfer') || t.includes('wallet')) return TYPE_ICONS.money;
  if (t.includes('message') || t.includes('chat')) return TYPE_ICONS.message;
  if (t.includes('reaction') || t.includes('like')) return TYPE_ICONS.reaction;
  if (t.includes('kyc') || t.includes('verify')) return TYPE_ICONS.verified;
  if (t.includes('security') || t.includes('moderation') || t.includes('warn')) return TYPE_ICONS.security;
  if (t.includes('role') || t.includes('upgrade') || t.includes('award')) return TYPE_ICONS.award;

  return TYPE_ICONS.default;
}

export function WebInAppNotification({
  title,
  message,
  body,
  senderName,
  senderAvatar,
  type,
  isOfficial,
  isVerified,
  actionUrl,
  actionLabel,
  onAction,
  onDismiss,
}: WebNotificationData) {
  const contentText = message || body || '';
  const displayTitle = title || senderName || 'New Notification';
  const isOfficialAlert = Boolean(
    isOfficial ||
    senderName === 'Murih Notifications Official' ||
    (type && ['role_upgrade_approved', 'role_upgrade_rejected', 'kyc_approved', 'kyc_rejected'].includes(type))
  );
  const hasVerifiedBadge = Boolean(isVerified || isOfficialAlert);
  const style = resolveTypeStyle(type, isOfficialAlert);

  const handleClick = (e: React.MouseEvent) => {
    // If clicking close button, do not trigger action
    if ((e.target as HTMLElement).closest('.close-btn')) return;

    if (onAction) {
      onAction();
    } else if (actionUrl) {
      if (actionUrl.startsWith('http')) {
        window.location.href = actionUrl;
      } else {
        window.location.href = actionUrl;
      }
    }
    onDismiss?.();
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      className="group relative w-full max-w-sm rounded-2xl p-3.5 backdrop-blur-2xl bg-slate-900/95 dark:bg-slate-950/95 border border-white/15 shadow-[0_16px_36px_rgba(0,0,0,0.55),0_0_20px_rgba(0,136,204,0.15)] text-white transition-all duration-200 hover:scale-[1.01] hover:border-[#0088cc]/50 cursor-pointer overflow-hidden select-none"
    >
      {/* Top Animated Accent Glow Line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#0088cc] to-transparent opacity-80" />

      <div className="flex items-start gap-3">
        {/* Left: Avatar or Icon Badge */}
        <div className="relative shrink-0 mt-0.5">
          {senderAvatar ? (
            <div className="relative">
              <img
                src={senderAvatar}
                alt={senderName || 'Sender'}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-white/20 shadow-md"
              />
              {hasVerifiedBadge && (
                <CheckCircle
                  weight="fill"
                  className="w-3.5 h-3.5 text-[#0088cc] bg-white rounded-full absolute -bottom-0.5 -right-0.5 shadow-sm"
                />
              )}
            </div>
          ) : (
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${style.bg} ${style.border}`}
            >
              {style.icon}
            </div>
          )}
        </div>

        {/* Center: Title, Channel, & Content */}
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-black tracking-tight text-white truncate max-w-[170px]">
              {senderName || (isOfficialAlert ? 'Murih Official' : displayTitle)}
            </span>
            {hasVerifiedBadge && (
              <CheckCircle
                weight="fill"
                className="w-3.5 h-3.5 text-[#0088cc] shrink-0 fill-[#0088cc]"
              />
            )}
            <span className="text-[10px] text-slate-400 font-medium ml-auto">Just now</span>
          </div>

          {/* Subtitle / Title if distinct */}
          {displayTitle && displayTitle !== senderName && (
            <h4 className="text-[13px] font-bold text-slate-100 mt-0.5 truncate leading-snug">
              {displayTitle}
            </h4>
          )}

          {/* Body Content */}
          {contentText && (
            <p className="text-xs text-slate-300 font-normal line-clamp-2 leading-relaxed mt-0.5">
              {contentText}
            </p>
          )}

          {/* Action Button Row */}
          {(actionLabel || actionUrl) && (
            <div className="mt-2.5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-[#0088cc] hover:bg-[#0077b5] px-2.5 py-1 rounded-lg transition-colors shadow-sm">
                <span>{actionLabel || 'View'}</span>
                <ArrowRight weight="bold" className="w-3 h-3" />
              </span>
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss?.();
          }}
          className="close-btn absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Dismiss"
        >
          <X weight="bold" className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Dispatches a high-end in-app notification banner on Web using sonner's custom renderer.
 */
export function showWebInAppNotification(data: WebNotificationData) {
  toast.custom(
    (t) => (
      <WebInAppNotification
        {...data}
        onDismiss={() => {
          data.onDismiss?.();
          toast.dismiss(t);
        }}
        onAction={() => {
          data.onAction?.();
          toast.dismiss(t);
          if (data.actionUrl) {
            window.location.href = data.actionUrl;
          }
        }}
      />
    ),
    {
      duration: 6000,
    }
  );
}

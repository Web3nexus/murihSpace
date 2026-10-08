import React from 'react';
import { toast } from 'sonner';
import {
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
  PhoneCall,
  LockKey,
} from '@phosphor-icons/react';

export interface WebNotificationData {
  id?: string | number;
  title?: string;
  subtitle?: string;
  message?: string;
  body?: string;
  senderName?: string;
  senderAvatar?: string;
  type?: string;
  isOfficial?: boolean;
  isVerified?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  code?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

interface TypeStyle {
  icon: React.ReactNode;
  bgGradient: string;
  badgeBg: string;
}

const TYPE_STYLES: Record<string, TypeStyle> = {
  message: {
    icon: <ChatTeardropText weight="fill" className="w-6 h-6 text-white" />,
    bgGradient: 'from-[#1EBE5D] to-[#25D366]',
    badgeBg: 'bg-[#25D366]',
  },
  call: {
    icon: <PhoneCall weight="fill" className="w-6 h-6 text-white" />,
    bgGradient: 'from-[#128C7E] to-[#25D366]',
    badgeBg: 'bg-[#25D366]',
  },
  official: {
    icon: <PaperPlaneTilt weight="fill" className="w-6 h-6 text-white" />,
    bgGradient: 'from-[#0284c7] to-[#0ea5e9]',
    badgeBg: 'bg-sky-500',
  },
  gift: {
    icon: <Gift weight="fill" className="w-6 h-6 text-white" />,
    bgGradient: 'from-[#db2777] to-[#ec4899]',
    badgeBg: 'bg-pink-500',
  },
  money: {
    icon: <Wallet weight="fill" className="w-6 h-6 text-white" />,
    bgGradient: 'from-[#059669] to-[#10b981]',
    badgeBg: 'bg-emerald-500',
  },
  reaction: {
    icon: <Lightning weight="fill" className="w-6 h-6 text-white" />,
    bgGradient: 'from-[#d97706] to-[#f59e0b]',
    badgeBg: 'bg-amber-500',
  },
  security: {
    icon: <ShieldWarning weight="fill" className="w-6 h-6 text-white" />,
    bgGradient: 'from-[#e11d48] to-[#f43f5e]',
    badgeBg: 'bg-rose-500',
  },
  verified: {
    icon: <ShieldCheck weight="fill" className="w-6 h-6 text-white" />,
    bgGradient: 'from-[#059669] to-[#10b981]',
    badgeBg: 'bg-emerald-500',
  },
  award: {
    icon: <Trophy weight="fill" className="w-6 h-6 text-white" />,
    bgGradient: 'from-[#d97706] to-[#f59e0b]',
    badgeBg: 'bg-amber-500',
  },
  auth: {
    icon: <LockKey weight="fill" className="w-6 h-6 text-white" />,
    bgGradient: 'from-[#4f46e5] to-[#6366f1]',
    badgeBg: 'bg-indigo-500',
  },
  default: {
    icon: <ChatTeardropText weight="fill" className="w-6 h-6 text-white" />,
    bgGradient: 'from-[#1EBE5D] to-[#25D366]',
    badgeBg: 'bg-[#25D366]',
  },
};

function resolveTypeStyle(type?: string, isOfficial?: boolean): TypeStyle {
  if (isOfficial) return TYPE_STYLES.official;
  if (!type) return TYPE_STYLES.default;

  const t = type.toLowerCase();
  if (t.includes('call')) return TYPE_STYLES.call;
  if (t.includes('gift')) return TYPE_STYLES.gift;
  if (t.includes('money') || t.includes('transfer') || t.includes('wallet')) return TYPE_STYLES.money;
  if (t.includes('message') || t.includes('chat')) return TYPE_STYLES.message;
  if (t.includes('reaction') || t.includes('like')) return TYPE_STYLES.reaction;
  if (t.includes('kyc') || t.includes('verify')) return TYPE_STYLES.verified;
  if (t.includes('security') || t.includes('moderation') || t.includes('warn')) return TYPE_STYLES.security;
  if (t.includes('role') || t.includes('upgrade') || t.includes('award')) return TYPE_STYLES.award;
  if (t.includes('auth') || t.includes('login') || t.includes('code')) return TYPE_STYLES.auth;

  return TYPE_STYLES.default;
}

/**
 * WhatsApp Desktop style notification popup card.
 *
 * Recreates the iconic WhatsApp desktop notification aesthetic:
 * - Dark matte forest-slate rounded pill container with backdrop blur
 * - Rounded squircle app icon / sender avatar (with WhatsApp-green badge)
 * - Three stacked lines:
 *     1. Sender / Contact Name (bold white)
 *     2. Subtitle / Chat Context (e.g. Chat Name / Handle)
 *     3. Message text preview
 * - Time indicator and smooth hover dismiss
 */
export function WebInAppNotification({
  title,
  subtitle,
  message,
  body,
  senderName,
  senderAvatar,
  type,
  isOfficial,
  isVerified,
  actionUrl,
  actionLabel,
  code,
  onAction,
  onDismiss,
}: WebNotificationData) {
  const contentText = message || body || '';
  const isOfficialAlert = Boolean(
    isOfficial ||
    senderName === 'Murih Notifications Official' ||
    (type && ['role_upgrade_approved', 'role_upgrade_rejected', 'kyc_approved', 'kyc_rejected'].includes(type))
  );
  const hasVerifiedBadge = Boolean(isVerified || isOfficialAlert);
  const style = resolveTypeStyle(type, isOfficialAlert);

  // Line 1: Primary Sender / Contact Name
  const displaySender = senderName || title || (isOfficialAlert ? 'MurihSpace' : 'MurihSpace');

  // Line 2: Chat / Subtitle Context (e.g. group name, handle, or contact identifier)
  const displaySubtitle = subtitle || (title && title !== displaySender ? title : (isOfficialAlert ? 'Official Update' : 'MurihSpace'));

  // Line 3: Message preview text
  const displayMessage = contentText || (code ? `Verification code: ${code}` : 'New message received');

  const handleClick = (e: React.MouseEvent) => {
    // If clicking close button, do not trigger action
    if ((e.target as HTMLElement).closest('.close-btn')) return;

    // Clicking a 2FA/login code notification copies the code and dismisses
    if (code) {
      void navigator.clipboard?.writeText(code).catch(() => {});
      onDismiss?.();
      return;
    }

    if (onAction) {
      onAction();
    } else if (actionUrl) {
      window.location.href = actionUrl;
    }
    onDismiss?.();
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      className="group relative flex items-center gap-3.5 w-[360px] max-w-[calc(100vw-32px)] px-3.5 py-3 rounded-[20px] bg-[#141A16]/96 dark:bg-[#121814]/96 backdrop-blur-2xl border border-white/[0.12] shadow-[0_16px_40px_rgba(0,0,0,0.7),0_2px_8px_rgba(0,0,0,0.5)] text-white transition-all duration-200 hover:scale-[1.01] hover:border-emerald-500/35 hover:bg-[#18211b]/98 cursor-pointer select-none overflow-hidden"
    >
      {/* Left: WhatsApp Squircle Icon / Sender Avatar */}
      <div className="relative shrink-0 flex items-center justify-center">
        {senderAvatar ? (
          <div className="relative w-11 h-11">
            <img
              src={senderAvatar}
              alt={displaySender}
              className="w-11 h-11 rounded-[14px] object-cover ring-1 ring-white/15 shadow-sm"
            />
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${style.badgeBg} ring-2 ring-[#141A16] flex items-center justify-center text-white shadow-sm`}>
              <ChatTeardropText weight="fill" className="w-2.5 h-2.5" />
            </div>
          </div>
        ) : (
          <div
            className={`w-11 h-11 rounded-[14px] bg-gradient-to-tr ${style.bgGradient} flex items-center justify-center shadow-md shadow-emerald-950/40 text-white`}
          >
            {style.icon}
          </div>
        )}
      </div>

      {/* Center: 3 Stacked Lines (WhatsApp Native Layout) */}
      <div className="flex-1 min-w-0 pr-6">
        {/* Line 1: Contact / Sender Name */}
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-[13px] text-white truncate leading-tight tracking-tight">
            {displaySender}
          </span>
          {hasVerifiedBadge && (
            <CheckCircle
              weight="fill"
              className="w-3.5 h-3.5 text-[#25D366] shrink-0 fill-[#25D366]"
            />
          )}
        </div>

        {/* Line 2: Chat Subtitle / Context */}
        <div className="text-[12px] font-medium text-white/85 truncate leading-tight mt-0.5">
          {displaySubtitle}
        </div>

        {/* Line 3: Message preview text */}
        <div className="text-[12px] text-white/70 truncate leading-tight mt-0.5">
          {displayMessage}
        </div>

        {/* Verification Code Quick-Copy Tag */}
        {code && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[11px] font-mono font-black tracking-widest px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {code}
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold">Click to copy</span>
          </div>
        )}

        {/* Optional Action Button Row */}
        {actionLabel && !code && (
          <div className="mt-1.5 flex items-center">
            <span className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
              <span>{actionLabel}</span>
              <ArrowRight weight="bold" className="w-2.5 h-2.5" />
            </span>
          </div>
        )}
      </div>

      {/* Top Right: Time Indicator & Hover Dismiss Button */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
        <span className="text-[10px] text-white/40 font-medium group-hover:opacity-0 transition-opacity">
          now
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss?.();
          }}
          className="close-btn p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
          title="Dismiss"
        >
          <X weight="bold" className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Dispatches a WhatsApp-style desktop notification popup banner on Web.
 * Also triggers native OS desktop notifications if tab is hidden/minimized and permission is granted.
 */
export function showWebInAppNotification(data: WebNotificationData) {
  // If the browser tab is hidden/minimized and desktop notifications are permitted, show native desktop notification
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted' &&
    document.visibilityState === 'hidden'
  ) {
    try {
      const nativeNotif = new Notification(data.senderName || data.title || 'MurihSpace', {
        body: data.message || data.body || '',
        icon: data.senderAvatar || '/assets/murihspace-live-logo.png',
        badge: '/assets/murihspace-live-logo.png',
        tag: String(data.id || Date.now()),
      });
      nativeNotif.onclick = () => {
        window.focus();
        if (data.actionUrl) {
          window.location.href = data.actionUrl;
        }
        nativeNotif.close();
      };
    } catch (_) {}
  }

  // Display custom WhatsApp-style in-app banner
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
      duration: 5000,
    }
  );
}

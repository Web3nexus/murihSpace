import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Profile as UserIcon, Wallet, Folder, Notification as Bell, Lock, Discovery as Globe, Star, ShieldDone as ShieldCheck, ShieldDone as BadgeCheck, Activity as Waveform, Swap as ArrowCounterClockwise, Chat as ChatCircleDots, Bookmark, AddUser as UserPlus, Logout as SignOut, TickSquare as Check } from "@/components/icons";
import { Swap as ArrowsLeftRight } from "@/components/icons";
import { DeviceMobile as Smartphone, Sun, Crown, Storefront, Question, CurrencyDollar, Link as LinkIcon, Package, Truck } from "@/components/icons/rounded";;
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AddAccountDialog } from "@/components/account/AddAccountDialog";
import { cn } from "@/lib/utils";

interface ProfileMenuDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MenuLink {
  label: string;
  to: string;
  icon: React.ReactNode;
}

interface MenuGroup {
  title?: string;
  links: MenuLink[];
}

const iconClass = "h-4 w-4 text-muted-foreground shrink-0";

function getRoleGroups(role: string): MenuGroup[] {
  if (role === "admin") {
    return [
      {
        links: [
          { label: "My Profile", to: "/app/settings", icon: <UserIcon weight="fill" className={iconClass} /> },
          { label: "Active Sessions & Devices", to: "/app/settings/security", icon: <Smartphone weight="fill" className={iconClass} /> },
          { label: "Privacy & Password", to: "/app/settings/privacy", icon: <Lock weight="fill" className={iconClass} /> },
          { label: "Appearance & Theme", to: "/app/settings/preferences", icon: <Sun weight="fill" className={iconClass} /> },
        ],
      },
      {
        title: "Admin Control Panel",
        links: [
          { label: "Admin Notification Center", to: "/app/securegate/notifications", icon: <Bell weight="fill" className={iconClass} /> },
          { label: "User Management", to: "/app/securegate/users", icon: <ShieldCheck weight="fill" className={iconClass} /> },
          { label: "KYC & Identity Verification", to: "/app/securegate/kyc", icon: <BadgeCheck weight="fill" className={iconClass} /> },
          { label: "Platform Fee Management", to: "/app/securegate/fees", icon: <CurrencyDollar weight="fill" className={iconClass} /> },
          { label: "System Health & Logs", to: "/app/securegate/system-health", icon: <Waveform weight="fill" className={iconClass} /> },
        ],
      },
    ];
  }

  const groups: MenuGroup[] = [
    {
      links: [
        { label: "My Profile", to: "/app/settings", icon: <UserIcon weight="fill" className={iconClass} /> },
        { label: "Wallet & Balance", to: "/app/wallet", icon: <Wallet weight="fill" className={iconClass} /> },
      ],
    },
    {
      title: "Messages & Security",
      links: [
        { label: "Active Sessions & Devices", to: "/app/settings/security", icon: <Smartphone weight="fill" className={iconClass} /> },
        { label: "Community Chat Channels", to: "/app/community-chat", icon: <Folder weight="fill" className={iconClass} /> },
        { label: "Automated Greeting & Replies", to: "/app/settings/automated-replies", icon: <ChatCircleDots weight="fill" className={iconClass} /> },
      ],
    },
    {
      title: "Preferences",
      links: [
        { label: "Notifications & Sounds", to: "/app/settings/notifications", icon: <Bell weight="fill" className={iconClass} /> },
        { label: "Privacy & Security", to: "/app/settings/privacy", icon: <Lock weight="fill" className={iconClass} /> },
        { label: "Appearance & Theme", to: "/app/settings/preferences", icon: <Sun weight="fill" className={iconClass} /> },
        { label: "Language & Region", to: "/app/settings/language", icon: <Globe weight="fill" className={iconClass} /> },
      ],
    },
  ];

  if (role === "creator") {
    groups.push({
      title: "Creator Management",
      links: [
        { label: "Storefront & Handle", to: "/app/store", icon: <Storefront weight="fill" className={iconClass} /> },
        { label: "Link in Bio & Theme", to: "/app/link-in-bio", icon: <LinkIcon weight="fill" className={iconClass} /> },
        { label: "KYC & Verification Badge", to: "/app/kyc", icon: <BadgeCheck weight="fill" className={iconClass} /> },
      ],
    });
  } else if (role === "vendor") {
    groups.push({
      title: "Vendor Storefront Management",
      links: [
        { label: "Physical Merchandise", to: "/app/store/physical", icon: <Package weight="fill" className={iconClass} /> },
        { label: "Order Fulfilment", to: "/app/store/fulfilment", icon: <Truck weight="fill" className={iconClass} /> },
        { label: "Returns & Refund Policy", to: "/app/store/returns", icon: <ArrowCounterClockwise weight="fill" className={iconClass} /> },
      ],
    });
  }

  const accountTier: MenuLink[] = [];
  if (role === "member") {
    accountTier.push({ label: "Become a Creator or Vendor", to: "/app/settings/upgrade", icon: <Crown weight="fill" className={iconClass} /> });
  }
  accountTier.push({ label: "My Stars & Gifts", to: "/app/gifts", icon: <Star weight="fill" className={iconClass} /> });
  accountTier.push({ label: "Support & Help Desk", to: "/app/settings/help", icon: <Question weight="fill" className={iconClass} /> });
  groups.push({ title: "Account Tier & Help", links: accountTier });

  return groups;
}

type ProfileRole = "member" | "creator" | "vendor" | "admin";

interface RoleApplication {
  requested_role: string;
  status: string;
}

const PROFILE_MODE_ORDER: ProfileRole[] = ["member", "creator", "vendor"];

function modeLabel(role: ProfileRole): string {
  switch (role) {
    case "member":
      return "Personal";
    case "creator":
      return "Creator";
    case "vendor":
      return "Vendor";
    case "admin":
      return "Admin";
  }
}

function modeAccent(role: ProfileRole): string {
  switch (role) {
    case "member":
      return "#5856D6";
    case "creator":
      return "#9C27B0";
    case "vendor":
      return "#00897B";
    case "admin":
      return "#DC2626";
  }
}

function modeIcon(role: ProfileRole, className: string) {
  switch (role) {
    case "member":
      return <UserIcon weight="fill" className={className} />;
    case "creator":
      return <Crown weight="fill" className={className} />;
    case "vendor":
      return <Storefront weight="fill" className={className} />;
    case "admin":
      return <ShieldCheck weight="fill" className={className} />;
  }
}

export function ProfileMenuDrawer({ open, onOpenChange }: ProfileMenuDrawerProps) {
  const { user, savedAccounts, logout, switchRole } = useAuth();
  const navigate = useNavigate();
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<number | null>(null);
  const [switchingMode, setSwitchingMode] = useState<ProfileRole | null>(null);
  const [history, setHistory] = useState<RoleApplication[]>([]);

  const role = (user?.role ?? "member") as ProfileRole;

  // Load the role history so we can offer every profile mode this account holds.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiClient
      .get("/role/history")
      .then((res) => {
        const payload = res.data?.history ?? res.data;
        if (!cancelled && Array.isArray(payload)) setHistory(payload);
      })
      .catch(() => {
        /* history is best-effort; personal mode is always available */
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // A business account that upgraded to Creator/Vendor keeps that profile and
  // can no longer fall back to the plain Member profile.
  const upgraded =
    role === "creator" ||
    role === "vendor" ||
    role === "admin" ||
    history.some(
      (entry) =>
        entry.status === "approved" &&
        (entry.requested_role === "creator" || entry.requested_role === "vendor"),
    );

  const availableModes = new Set<ProfileRole>();
  if (!upgraded) availableModes.add("member");
  if (role === "admin") {
    availableModes.add("creator");
    availableModes.add("vendor");
    availableModes.add("admin");
  } else if (role !== "member") {
    availableModes.add(role);
  }
  for (const entry of history) {
    if (entry.status === "approved") {
      const r = entry.requested_role as ProfileRole;
      if (PROFILE_MODE_ORDER.includes(r)) availableModes.add(r);
    }
  }
  const orderedModes = PROFILE_MODE_ORDER.filter((m) => availableModes.has(m));
  if (availableModes.has("admin")) orderedModes.push("admin");

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  // Saved accounts keep no credentials, so switching means signing in to that account again.
  const handleSwitch = async (id: number) => {
    setSwitchingId(id);
    onOpenChange(false);
    await logout();
    navigate("/login");
  };

  const handleLogout = async () => {
    onOpenChange(false);
    await logout();
    navigate("/login");
  };

  const handleSwitchMode = async (target: ProfileRole) => {
    setSwitchingMode(target);
    const ok = await switchRole(target);
    setSwitchingMode(null);
    if (ok) {
      onOpenChange(false);
      navigate("/app");
    }
  };

  const groups = getRoleGroups(role);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="left"
          className="w-[340px] max-w-[90vw] p-0 flex flex-col gap-0 bg-white dark:bg-[var(--shell-surface)]"
        >
          <SheetHeader className="p-0">
            <SheetTitle className="sr-only">Profile menu</SheetTitle>
          </SheetHeader>

          {/* Account header */}
          <button
            type="button"
            onClick={() => go("/app/profile")}
            className="flex items-center gap-3 p-4 text-left hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)] transition-colors"
          >
            <div className="h-12 w-12 rounded-full bg-[var(--shell-accent-solid)] text-white flex items-center justify-center shrink-0 overflow-hidden">
              {user?.avatar_url || user?.avatar ? (
                <img src={user.avatar_url || user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <UserIcon weight="fill" className="h-5 w-5 text-white/90" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{user?.name ?? "User"}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.username ? `@${user.username}` : user?.email}
              </p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--shell-accent-solid)]/15 text-[var(--shell-accent)] dark:text-[var(--shell-accent)] capitalize">
                {role}
              </span>
            </div>
          </button>

          <div className="h-px bg-border" />

          <div className="flex-1 overflow-y-auto">
            {/* Switch profile type (Personal ↔ Creator ↔ Vendor) */}
            {orderedModes.length > 1 && (
              <div className="p-2 border-b border-border">
                <div className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Switch profile type
                </div>
                {orderedModes.map((mode) => {
                  const isCurrent = mode === role;
                  const isBusy = switchingMode === mode;
                  const accent = modeAccent(mode);
                  return (
                    <button
                      key={mode}
                      type="button"
                      disabled={isCurrent || isBusy}
                      onClick={() => !isCurrent && handleSwitchMode(mode)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors",
                        isCurrent ? "bg-[var(--shell-accent-solid)]/10" : "hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)]"
                      )}
                    >
                      <span
                        className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: accent }}
                      >
                        {modeIcon(mode, "h-4 w-4 text-white")}
                      </span>
                      <span className="flex-1 font-semibold text-foreground truncate">
                        {modeLabel(mode)}
                      </span>
                      {isCurrent ? (
                        <span
                          className="flex items-center gap-1 text-[10px] font-bold"
                          style={{ color: accent }}
                        >
                          <Check weight="bold" className="h-3 w-3" /> Current
                        </span>
                      ) : (
                        <ArrowsLeftRight weight="fill" className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Account actions */}
            <div className="p-2">
              <MenuRow icon={<UserPlus weight="fill" className={iconClass} />} label="Add account" onClick={() => setAddAccountOpen(true)} />
              <MenuRow
                icon={<Bookmark weight="fill" className={iconClass} />}
                label="Saved"
                onClick={() => go("/app/store/saved-addresses")}
              />
            </div>

            {/* Switch profile */}
            <div className="px-3 pt-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              Switch account
            </div>
            <div className="px-2 pb-2">
              {savedAccounts.length <= 1 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  No other saved accounts yet. Use “Add account” to add one.
                </p>
              ) : (
                savedAccounts.map((account) => {
                  const isCurrent = account.id === user?.id;
                  const isSwitching = switchingId === account.id;
                  return (
                    <button
                      key={account.id}
                      type="button"
                      disabled={isCurrent || isSwitching}
                      onClick={() => !isCurrent && handleSwitch(account.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors",
                        isCurrent
                          ? "bg-[var(--shell-accent-solid)]/10"
                          : "hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)]"
                      )}
                    >
                      <div className="h-8 w-8 rounded-full bg-[var(--shell-accent-solid)]/20 text-[var(--shell-accent)] flex items-center justify-center shrink-0 overflow-hidden font-bold text-[11px]">
                        {account.avatar ? (
                          <img src={account.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (account.name?.[0] ?? "?").toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{account.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{account.email}</p>
                      </div>
                      {isCurrent ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--shell-accent)] dark:text-[var(--shell-accent)]">
                          <Check weight="bold" className="h-3 w-3" /> Current
                        </span>
                      ) : (
                        <ArrowsLeftRight weight="fill" className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Settings sections */}
            {groups.map((group, gi) => (
              <div key={group.title ?? `group-${gi}`} className="p-2 border-t border-border">
                {group.title && (
                  <div className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    {group.title}
                  </div>
                )}
                {group.links.map((link) => (
                  <MenuRow key={link.to + link.label} icon={link.icon} label={link.label} onClick={() => go(link.to)} />
                ))}
              </div>
            ))}
          </div>

          {/* Logout pinned at bottom */}
          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-destructive hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <SignOut weight="fill" className="h-4 w-4 shrink-0" />
              <span>Log Out</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <AddAccountDialog
        open={addAccountOpen}
        onOpenChange={setAddAccountOpen}
        onSuccess={() => navigate("/app/profile")}
      />
    </>
  );
}

function MenuRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-foreground hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)] transition-colors text-left"
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
    </button>
  );
}

import { Link, useLocation, useNavigate } from "react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Link2,
  Store,
  Briefcase,
  Megaphone,
  Users,
  MessageSquare,
  Wallet,
  BarChart3,
  Settings,
  ShieldAlert,
  UserCheck,
  FileText,
  BadgeDollarSign,
  ScrollText,
  ShieldCheck,
  Flag,
  ChevronsUpDown,
  LogOut,
  UserCircle,
  Bell,
  ChevronRight,
  Zap,
  Sparkles,
  Crown,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  title: string;
  url: string;
  icon: React.ReactNode;
  badge?: number | string;
  badgeColor?: string;
  children?: { title: string; url: string; badge?: string }[];
}

// ─── User / Creator Navigation (Beacons.ai & Stan Store Inspired) ───────────

const userNav: NavItem[] = [
  {
    title: "Home",
    url: "/app",
    icon: <LayoutDashboard className="size-4" />,
  },
  {
    title: "Link in Bio & Site",
    url: "/app/link-in-bio",
    icon: <Link2 className="size-4" />,
    children: [
      { title: "Link in Bio Builder", url: "/app/link-in-bio" },
      { title: "Themes & Design", url: "/app/link-in-bio/design" },
      { title: "Custom Domain & Site", url: "/app/link-in-bio/domain" },
    ],
  },
  {
    title: "MurihStore",
    url: "/app/store",
    icon: <Store className="size-4" />,
    badge: "Hot",
    badgeColor: "bg-[#38A8D8]",
    children: [
      { title: "Digital Downloads", url: "/app/store/digital" },
      { title: "Online Courses", url: "/app/store/courses" },
      { title: "1:1 Coaching & Bookings", url: "/app/store/coaching" },
      { title: "Physical Products & Merch", url: "/app/store/physical" },
      { title: "Subscriptions & Memberships", url: "/app/store/subscriptions" },
    ],
  },
  {
    title: "Brand Deals & Media Kit",
    url: "/app/brand-deals",
    icon: <Briefcase className="size-4" />,
    children: [
      { title: "Creator Media Kit", url: "/app/brand-deals/media-kit" },
      { title: "Outreach & Proposals", url: "/app/brand-deals/proposals" },
      { title: "Brand Invoicing", url: "/app/brand-deals/invoicing" },
    ],
  },
  {
    title: "Marketing & Funnels",
    url: "/app/marketing",
    icon: <Megaphone className="size-4" />,
    children: [
      { title: "Email Broadcasts", url: "/app/marketing/broadcasts" },
      { title: "Automated Sequences", url: "/app/marketing/sequences" },
      { title: "Affiliate Products", url: "/app/marketing/affiliates" },
      { title: "Referral Program", url: "/app/marketing/referrals" },
    ],
  },
  {
    title: "Community & Feed",
    url: "/app/communities",
    icon: <Users className="size-4" />,
    children: [
      { title: "My Communities", url: "/app/communities" },
      { title: "Feed & Posts", url: "/app/communities/feed" },
      { title: "Audio Rooms", url: "/app/audio-rooms" },
      { title: "Events", url: "/app/events" },
    ],
  },
  {
    title: "Messages",
    url: "/app/messages",
    icon: <MessageSquare className="size-4" />,
    badge: 4,
    badgeColor: "bg-[#38A8D8]",
  },
  {
    title: "Memberships",
    url: "/app/subscriptions",
    icon: <Crown className="size-4" />,
    children: [
      { title: "Discover Plans", url: "/app/subscriptions" },
      { title: "My Subscriptions", url: "/app/subscriptions/mine" },
      { title: "My Plans (Creator)", url: "/app/store/subscriptions" },
    ],
  },
  {
    title: "MurihPay Wallet",
    url: "/app/wallet",
    icon: <Wallet className="size-4" />,
    children: [
      { title: "Balance & Payouts", url: "/app/wallet" },
      { title: "Sales & Receipts", url: "/app/wallet/sales" },
      { title: "Purchase Library", url: "/app/wallet/purchases" },
      { title: "Tips & Donations", url: "/app/wallet/donations" },
      { title: "Escrow Balances", url: "/app/wallet/escrow" },
    ],
  },
  {
    title: "Analytics & Sales",
    url: "/app/analytics",
    icon: <BarChart3 className="size-4" />,
    children: [
      { title: "Link & Traffic Stats", url: "/app/analytics/traffic" },
      { title: "Revenue & Conversions", url: "/app/analytics/revenue" },
      { title: "Milestones & Badges", url: "/app/analytics/milestones" },
    ],
  },
  {
    title: "Settings",
    url: "/app/settings",
    icon: <Settings className="size-4" />,
    children: [
      { title: "Profile & Identity", url: "/app/settings" },
      { title: "KYC Verification", url: "/app/settings/kyc" },
      { title: "Security & Sessions", url: "/app/settings/security" },
      { title: "Notifications", url: "/app/settings/notifications" },
    ],
  },
];

// ─── Platform Admin Navigation ────────────────────────────────────────────────

const adminNav: NavItem[] = [
  {
    title: "Admin Overview",
    url: "/app/securegate",
    icon: <ShieldAlert className="size-4" />,
  },
  {
    title: "KYC Approvals",
    url: "/app/securegate/kyc",
    icon: <UserCheck className="size-4" />,
    children: [
      { title: "Pending Queue", url: "/app/securegate/kyc" },
      { title: "Approved Creators", url: "/app/securegate/kyc" },
      { title: "Rejected Submissions", url: "/app/securegate/kyc" },
    ],
  },
  {
    title: "Feature Flags",
    url: "/app/securegate/feature-flags",
    icon: <Flag className="size-4" />,
  },
  {
    title: "User Directory",
    url: "/app/securegate/users",
    icon: <Users className="size-4" />,
    children: [
      { title: "All Accounts", url: "/app/securegate/users" },
      { title: "Verified Creators", url: "/app/securegate/users" },
      { title: "Vendors & Partners", url: "/app/securegate/users" },
      { title: "Banned Accounts", url: "/app/securegate/users" },
    ],
  },
  {
    title: "Communities & Content",
    url: "/app/securegate/communities",
    icon: <ShieldCheck className="size-4" />,
    children: [
      { title: "All Communities", url: "/app/securegate/communities" },
      { title: "Content Reports", url: "/app/securegate/communities" },
      { title: "Moderation Logs", url: "/app/securegate/communities" },
    ],
  },
  {
    title: "Platform Ledger & Escrow",
    url: "/app/securegate/transactions",
    icon: <BadgeDollarSign className="size-4" />,
    children: [
      { title: "All Transactions", url: "/app/securegate/transactions" },
      { title: "Withdrawals & Payouts", url: "/app/securegate/transactions" },
      { title: "Escrow Holds", url: "/app/securegate/transactions" },
      { title: "Disputes & Refunds", url: "/app/securegate/transactions" },
    ],
  },
  {
    title: "Content Reports",
    url: "/app/securegate/reports",
    icon: <FileText className="size-4" />,
    badge: 14,
    children: [
      { title: "Open Complaints", url: "/app/securegate/reports" },
      { title: "Audit Trail", url: "/app/securegate/reports" },
      { title: "System Health", url: "/app/securegate/reports" },
    ],
  },
  {
    title: "Platform Analytics",
    url: "/app/securegate/analytics",
    icon: <BarChart3 className="size-4" />,
    children: [
      { title: "Ecosystem Growth", url: "/app/securegate/analytics" },
      { title: "Revenue Breakdown", url: "/app/securegate/analytics" },
      { title: "Conversion Metrics", url: "/app/securegate/analytics" },
    ],
  },
  {
    title: "Plans & Platform Fees",
    url: "/app/securegate/plans",
    icon: <ScrollText className="size-4" />,
    children: [
      { title: "Tier Pricing", url: "/app/securegate/plans" },
      { title: "Transaction Fee Matrix", url: "/app/securegate/plans" },
    ],
  },
  {
    title: "Website CMS",
    url: "/app/securegate/cms",
    icon: <Megaphone className="size-4" />,
    children: [
      { title: "Landing Pages", url: "/app/securegate/cms" },
      { title: "Announcements", url: "/app/securegate/cms" },
    ],
  },
];

// ─── Brand Logo ───────────────────────────────────────────────────────────────

function BrandLogo({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Link
      to={isAdmin ? "/app/securegate" : "/app"}
      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg group"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#38A8D8] shadow-md transition-transform group-hover:scale-105">
        {isAdmin ? (
          <ShieldAlert className="size-4 text-white" />
        ) : (
          <Sparkles className="size-4 text-white" />
        )}
      </div>
      <div className="leading-none">
        <span className="text-[15px] font-bold text-white tracking-[-0.3px]">
          {isAdmin ? "MurihAdmin" : "MurihSpace"}
        </span>
        <span className="block text-[10px] text-[#38A8D8] font-medium mt-0.5 uppercase tracking-wider">
          {isAdmin ? "Platform Engine" : "Creator Ecosystem"}
        </span>
      </div>
    </Link>
  );
}

// ─── Single Nav Row ───────────────────────────────────────────────────────────

function NavRow({ item }: { item: NavItem }) {
  const { pathname } = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const isActive =
    pathname === item.url ||
    (item.url !== "/app" && pathname.startsWith(item.url)) ||
    item.children?.some((c) => pathname === c.url);
  const hasChildren = !!item.children?.length;

  if (!hasChildren) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={!!isActive}
          tooltip={item.title}
          className="relative group/item h-9 gap-3 rounded-lg px-3 text-[13.5px] font-medium
            text-sidebar-foreground/80 transition-all duration-150
            hover:bg-white/10 hover:text-white
            data-[active=true]:bg-[#38A8D8]/20 data-[active=true]:text-white data-[active=true]:font-semibold"
        >
          <Link to={item.url}>
            <span className="shrink-0 opacity-70 group-hover/item:opacity-100 data-[active=true]:opacity-100">
              {item.icon}
            </span>
            <span className="flex-1 truncate">{item.title}</span>
            {item.badge != null && !collapsed && (
              <span
                className={`ml-auto flex h-4.5 min-w-[18px] items-center justify-center rounded-full ${
                  item.badgeColor || "bg-[#38A8D8]"
                } px-1.5 text-[10px] font-bold text-white shadow-xs`}
              >
                {item.badge}
              </span>
            )}
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-[#38A8D8]" />
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible asChild defaultOpen={!!isActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={!!isActive}
            tooltip={item.title}
            className="relative group/item h-9 gap-3 rounded-lg px-3 text-[13.5px] font-medium
              text-sidebar-foreground/80 transition-all duration-150
              hover:bg-white/10 hover:text-white
              data-[active=true]:bg-[#38A8D8]/20 data-[active=true]:text-white data-[active=true]:font-semibold"
          >
            <span className="shrink-0 opacity-70 group-hover/item:opacity-100">{item.icon}</span>
            <span className="flex-1 truncate">{item.title}</span>
            {item.badge != null && !collapsed && (
              <span
                className={`flex h-4.5 min-w-[18px] items-center justify-center rounded-full ${
                  item.badgeColor || "bg-[#38A8D8]"
                } px-1.5 text-[10px] font-bold text-white shadow-xs`}
              >
                {item.badge}
              </span>
            )}
            <ChevronRight className="size-3.5 shrink-0 opacity-50 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-[#38A8D8]" />
            )}
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="ml-7 mt-0.5 mb-1 border-l border-white/10 pl-3 space-y-0.5">
            {item.children!.map((child) => (
              <Link
                key={child.title}
                to={child.url}
                className={`flex items-center justify-between rounded-md py-1.5 px-2 text-[12.5px] transition-colors duration-100 ${
                  pathname === child.url
                    ? "text-white font-semibold bg-white/8"
                    : "text-sidebar-foreground/60 hover:text-white hover:bg-white/8"
                }`}
              >
                <span className="truncate">{child.title}</span>
                {child.badge && (
                  <span className="text-[9px] px-1 rounded bg-[#38A8D8]/30 text-[#38A8D8] font-bold uppercase">
                    {child.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

// ─── User Footer ──────────────────────────────────────────────────────────────

const mockUser = {
  name: "Elena Rivera",
  email: "elena@murihspace.com",
  avatar: "",
  plan: "Beacons Pro / Murih VIP",
  planExpiry: "All features unlocked",
};

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function UserFooter({ isAdmin }: { isAdmin: boolean }) {
  const navigate = useNavigate();
  const { isMobile } = useSidebar();

  return (
    <div className="space-y-2 px-1">
      {/* Plan banner inspired by Beacons Pro button */}
      {!isAdmin && (
        <div className="mx-1 rounded-xl bg-gradient-to-r from-[#38A8D8] to-[#102840] p-0.5 shadow-md">
          <div className="rounded-[10px] bg-[#102840]/90 p-2.5 backdrop-blur-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="size-3.5 text-[#38A8D8] animate-pulse" />
                <span className="text-[12px] font-bold text-white tracking-wide">MURIH PRO</span>
              </div>
              <span className="text-[10px] font-semibold bg-[#38A8D8]/20 text-[#38A8D8] px-1.5 py-0.5 rounded">ACTIVE</span>
            </div>
            <p className="text-[10.5px] text-white/60 mt-1">Bio, Store, Media Kit & Mail active</p>
          </div>
        </div>
      )}

      {/* User row */}
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="h-auto gap-2.5 rounded-xl px-2 py-2 hover:bg-white/10 data-[state=open]:bg-white/10"
              >
                <Avatar className="h-8 w-8 rounded-lg shrink-0">
                  <AvatarImage src={mockUser.avatar} alt={mockUser.name} />
                  <AvatarFallback className="rounded-lg bg-[#38A8D8] text-white text-xs font-bold">
                    {initials(mockUser.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-[13px] font-semibold text-white">{mockUser.name}</span>
                  <span className="truncate text-[11px] text-white/50">{isAdmin ? "Platform Administrator" : "@elenarivera"}</span>
                </div>
                <ChevronsUpDown className="size-3.5 shrink-0 text-white/40" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              className="w-56 rounded-xl"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={6}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2.5 px-2 py-2">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={mockUser.avatar} alt={mockUser.name} />
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-xs font-bold">
                      {initials(mockUser.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid leading-tight">
                    <span className="text-[13px] font-semibold">{mockUser.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{mockUser.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                <Link to="/app/link-in-bio"><Link2 className="size-4" />My Link in Bio</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                <Link to="/app/settings"><UserCircle className="size-4" />Profile & Identity</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                <Link to="/app/settings/kyc"><ShieldCheck className="size-4" />KYC Verification</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                <Link to="/app/wallet"><Wallet className="size-4" />MurihPay Wallet</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                <Link to="/app/settings/notifications"><Bell className="size-4" />Notifications</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                onClick={() => { localStorage.removeItem("murihspace-token"); navigate("/login"); }}
              >
                <LogOut className="size-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </div>
  );
}

// ─── App Sidebar ──────────────────────────────────────────────────────────────

type SidebarProps = Omit<React.ComponentProps<typeof Sidebar>, "variant">;

interface AppSidebarProps extends SidebarProps {
  variant?: "user" | "admin";
}

export function AppSidebar({ variant = "user", ...props }: AppSidebarProps) {
  const isAdmin = variant === "admin";
  const navItems = isAdmin ? adminNav : userNav;

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-0 shadow-[2px_0_16px_rgba(16,40,64,0.18)]"
      {...props}
    >
      {/* ── Header: Logo / Brand ── */}
      <SidebarHeader className="px-3 pt-3 pb-2">
        <BrandLogo isAdmin={isAdmin} />
      </SidebarHeader>

      <SidebarSeparator className="opacity-20 mx-3" />

      {/* ── Navigation ── */}
      <SidebarContent className="px-2 py-1.5 gap-0">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-3 py-2 text-[10.5px] font-semibold uppercase tracking-widest text-white/30">
            {isAdmin ? "System Management" : "Creator Tools"}
          </SidebarGroupLabel>
          <SidebarMenu className="gap-0.5">
            {navItems.map((item) => (
              <NavRow key={item.title} item={item} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator className="opacity-20 mx-3" />

      {/* ── Footer: User + Plan banner ── */}
      <SidebarFooter className="p-2 pb-3">
        <UserFooter isAdmin={isAdmin} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

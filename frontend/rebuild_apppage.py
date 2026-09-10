import re

with open('src/pages/AppPage.tsx', 'r') as f:
    content = f.read()

# 1. Replace lucide imports with phosphor imports
content = re.sub(
    r'import \{[\s\S]*?\} from "lucide-react";',
    '''import {
  TrendUp,
  Users,
  Wallet,
  DeviceMobile,
  Lightbulb,
  Plus,
  ChatTeardropText,
  Package,
  Calendar,
  ChatCircle,
  Tray,
  Waveform,
  VideoCamera,
  ChartBar,
  Heart,
  ShareNetwork,
  DotsThree,
  CaretRight,
  Play,
  SealCheck,
  PaperPlaneRight,
  Spinner,
  Copy,
  Check,
  X,
  CaretDown,
  Rss,
  WarningCircle,
  ThumbsUp,
  ChatText
} from "@phosphor-icons/react";''',
    content
)

# Replace all occurrences of old lucide names with phosphor names
replacements = {
    'TrendingUp': 'TrendUp',
    'Smartphone': 'DeviceMobile',
    'MessageSquare': 'ChatTeardropText',
    'MessageCircle': 'ChatCircle',
    'Inbox': 'Tray',
    'Activity': 'Waveform',
    'Video': 'VideoCamera',
    'BarChart2': 'ChartBar',
    'Share2': 'ShareNetwork',
    'MoreHorizontal': 'DotsThree',
    'ChevronRight': 'CaretRight',
    'BadgeCheck': 'SealCheck',
    'Send': 'PaperPlaneRight',
    'Loader2': 'Spinner',
    'ChevronDown': 'CaretDown',
    'AlertCircle': 'WarningCircle'
}
for old, new in replacements.items():
    content = re.sub(r'\b' + old + r'\b', new, content)

# Also add weight="fill" to the phosphor icons in the JSX
for icon in replacements.values():
    content = re.sub(rf'<{icon}\b(?!.*weight="fill")', rf'<{icon} weight="fill"', content)
# And the ones that were already same name
same_names = ['Users', 'Wallet', 'Lightbulb', 'Plus', 'Package', 'Calendar', 'Heart', 'Play', 'Copy', 'Check', 'X', 'Rss']
for icon in same_names:
    content = re.sub(rf'<{icon}\b(?!.*weight="fill")', rf'<{icon} weight="fill"', content)

# 2. Rebuild the Right Rail
# We find the right rail block
right_rail_pattern = r'<div className="w-\[350px\] shrink-0 hidden lg:block p-4 space-y-4 overflow-y-auto h-screen sticky top-16 border-l border-border bg-transparent">([\s\S]*?)</div>\s*</div>\s*\{shareModalPost'

new_right_rail = '''<div className="w-[320px] shrink-0 hidden lg:block py-6 px-4 space-y-6 overflow-y-auto h-[calc(100vh-56px)] sticky top-14 bg-transparent border-none">
          {/* REQUESTS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-muted-foreground text-[13px] tracking-wide uppercase">Requests</h3>
              {(friendReqs.length > 0 || communityReqs.length > 0) && (
                <Link to="/app/requests" className="text-[13px] text-primary hover:underline">See all</Link>
              )}
            </div>
            {friendReqs.length === 0 && communityReqs.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No new requests</p>
            ) : (
              <div className="space-y-3">
                {friendReqs.slice(0,2).map(req => (
                  <div key={`f-${req.id}`} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex-shrink-0">
                      <img src={req.sender?.avatar_url || req.sender?.avatar || ""} className="w-full h-full rounded-full object-cover" alt="" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate">{req.sender?.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{req.mutual_friends} mutual friends</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleFriendRequestAction(req.id, "accept")} className="h-7 w-7 rounded-lg bg-primary text-white flex items-center justify-center hover:bg-primary/90"><Check weight="bold" className="size-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <hr className="border-border/50" />

          {/* SUGGESTED COMMUNITIES */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-muted-foreground text-[13px] tracking-wide uppercase">Suggested Communities</h3>
              <Link to="/app/communities" className="text-[13px] text-primary hover:underline">See all</Link>
            </div>
            <div className="space-y-3">
               <div className="flex items-center gap-3 cursor-pointer group">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0"><Users weight="fill" className="size-5" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors truncate">Global Creators</p>
                    <p className="text-[11px] text-muted-foreground truncate">12.5K Members</p>
                  </div>
               </div>
               <div className="flex items-center gap-3 cursor-pointer group">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0"><TrendUp weight="fill" className="size-5" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors truncate">Startup Hub</p>
                    <p className="text-[11px] text-muted-foreground truncate">8.2K Members</p>
                  </div>
               </div>
            </div>
          </div>
          
          <hr className="border-border/50" />

          {/* UPCOMING EVENTS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-muted-foreground text-[13px] tracking-wide uppercase">Upcoming Events</h3>
              <Link to="/app/events" className="text-[13px] text-primary hover:underline">See all</Link>
            </div>
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="w-10 h-11 rounded-lg bg-rose-50 border border-rose-100 flex flex-col items-center justify-center flex-shrink-0 dark:bg-rose-500/10 dark:border-rose-500/20">
                <span className="text-[10px] font-bold text-rose-500 uppercase leading-none mb-0.5">{analytics.upcomingEvent.month}</span>
                <span className="text-[14px] font-black text-rose-700 dark:text-rose-400 leading-none">{analytics.upcomingEvent.day}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors truncate">{analytics.upcomingEvent.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{analytics.upcomingEvent.date}</p>
              </div>
            </div>
          </div>

        </div>\n      </div>\n      {shareModalPost'''

content = re.sub(right_rail_pattern, new_right_rail, content)


# 3. Change the Home Feed layout to Center (max-720px)
content = content.replace('max-w-[760px] mx-auto', 'max-w-[720px] mx-auto pt-6')

# 4. Change Composer to 8px radius
content = content.replace('bg-card sm:border border-border sm:rounded-xl p-4 sm:p-5 space-y-4', 'bg-card sm:border border-border rounded-lg p-4 space-y-3')

# 5. Change Post to 8px radius, padding 16px
content = content.replace('bg-card sm:border border-border sm:rounded-xl p-4 sm:p-5 space-y-3', 'bg-card sm:border border-border rounded-lg p-4 space-y-3')

with open('src/pages/AppPage.tsx', 'w') as f:
    f.write(content)

print("Updated AppPage.tsx")

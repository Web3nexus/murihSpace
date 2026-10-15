import { Discovery as Compass, N2User as Users, Chat as ChatCircleDots, Video as VideoCamera, Video as VideoConference, Location as MapPin, Chat as ChatCircle, Star, Wallet, Profile as UserCircle, ShieldDone as ShieldCheck, Setting as Gear } from "@/components/icons";
import { Rss, Broadcast, Crown } from "@/components/icons/rounded";;
import type { NavGroup } from "./navTypes";

export const memberNav: NavGroup[] = [
  {
    title: "",
    items: [
      {
        title: "Discover",
        url: "/app/discover",
        icon: <Compass weight="fill" className="h-5 w-5" />,
      },
      {
        title: "Live Now",
        url: "/app/live",
        icon: <Broadcast weight="fill" className="h-5 w-5" />,
        badge: "LIVE",
      },
      {
        title: "Community",
        url: "/app/communities",
        icon: <Users weight="fill" className="h-5 w-5" />,
        featureFlag: "community_hub",
      },
      {
        title: "Groups",
        url: "/app/groups",
        icon: <ChatCircleDots weight="fill" className="h-5 w-5" />,
      },
      {
        title: "Feed",
        url: "/app/feed",
        icon: <Rss weight="fill" className="h-5 w-5" />,
        featureFlag: "community_feed",
      },
      {
        title: "Live Video & Events",
        url: "/app/events",
        icon: <VideoCamera weight="fill" className="h-5 w-5" />,
        featureFlag: "events",
      },
      {
        title: "Meetings",
        url: "/app/meetings",
        icon: <VideoConference weight="fill" className="h-5 w-5" />,
      },
      {
        title: "Friends",
        url: "/app/friends",
        icon: <Users weight="fill" className="h-5 w-5" />,
        featureFlag: "friends",
      },
      {
        title: "Saved Addresses",
        url: "/app/store/saved-addresses",
        icon: <MapPin weight="fill" className="h-5 w-5" />,
      },
      {
        title: "Reviews & Disputes",
        url: "/app/store/reviews",
        icon: <ChatCircle weight="fill" className="h-5 w-5" />,
      },
      {
        title: "My Stars & Gifts",
        url: "/app/gifts",
        icon: <Star weight="fill" className="h-5 w-5" />,
      },
      {
        title: "MurihPay Wallet",
        url: "/app/wallet",
        icon: <Wallet weight="fill" className="h-5 w-5" />,
        featureFlag: "wallet",
      },
    ],
  },
  {
    title: "Shortcuts",
    items: [
      {
        title: "Profile & Identity",
        url: "/app/settings/profile",
        icon: <UserCircle weight="fill" className="h-5 w-5" />,
      },
      {
        title: "Account Settings",
        url: "/app/settings",
        icon: <Gear weight="fill" className="h-5 w-5" />,
      },
      {
        title: "Upgrade Account",
        url: "/app/settings/upgrade",
        icon: <Crown weight="fill" className="h-5 w-5" />,
      },
      {
        title: "KYC Verification",
        url: "/app/kyc",
        icon: <ShieldCheck weight="fill" className="h-5 w-5" />,
        featureFlag: "kyc",
      },
    ],
  },
];

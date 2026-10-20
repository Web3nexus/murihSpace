# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Creators, vendors and fans/members, all three on the same web dashboard (`web/frontend`). Creators publish, grow an audience and sell; vendors run storefronts, products, orders and inventory; fans and members join communities, rooms and events, and message. Hosting in live rooms is reserved for Creator and Vendor accounts.

## Product Purpose
MurihSpace is an API-first social commerce platform for creators. It combines a social space (communities, posts, statuses, messaging, events, audio rooms, bookings, memberships), a storefront (digital and physical products, orders, inventory, escrow) and a wallet (payments, transfers, donations, withdrawals). Success on the web is an engaged audience: a live feed people return to, and creators and vendors who turn that attention into sales and bookings.

## Positioning
One account that is simultaneously a social feed, a shop and a wallet for the same creator, with live rooms (instant meetings with chat, reactions and gifts) as part of the feed rather than a separate tool.

## Operating Context
- Web dashboard: React + Vite SPA, Laravel API, real-time via Echo/Pusher, live rooms via LiveKit, meeting signalling over WebSocket.
- Feed content is real backend data (posts, statuses, community activity, live rooms). No placeholder numbers or invented brand deals.
- Native mobile app (Flutter) shares the same product model; the web redesign must not contradict mobile behaviour.

## Capabilities and Constraints
- Role-based navigation exists for member, creator, vendor and admin. Routes and role menus are the information architecture; placement, density and visuals may change.
- Behaviour is product truth: a redesign changes how things look and are arranged, not what they do.
- Feature gating per role (see `docs/ROLE_PERMISSION_MATRIX.md`) must keep working.
- Undecided: whether creators and vendors get role-specific layouts. Not requested; one shared layout for now.

## Brand Commitments
- Name: MurihSpace.
- Brand blue `#2164b6` (decided by the user) through the shared tokens in `web/packages/brand`.
- No sparkle or magic-wand icons anywhere.
- Icon libraries: keep the current ones (Lucide, Hugeicons). The rule files now match this.
- Real data only; clean empty states instead of fabricated content.

## Evidence on Hand
- Existing feed implementation: `web/frontend/src/pages/FeedPage.tsx`, `web/frontend/src/pages/CommunityFeedPage.tsx`, `web/frontend/src/components/feed/PostCard.tsx`, `web/frontend/src/styles/feed.css`, `web/frontend/src/lib/feed.ts`.
- Mobile product notes: `mobile/PRODUCT.md`.
- Architecture and role docs: `docs/ARCHITECTURE.md`, `docs/ROLE_PERMISSION_MATRIX.md`, `docs/ROUTE_MAP.md`.
- The visual PRD in `docs/` (`.docx`/`.pdf`) has not been reviewed for this record.

## Product Principles
- The feed is the home of the product. Communities, posts, live rooms and statuses are the content; chrome stays out of their way.
- Attention is social: people, reactions, live presence and conversation come before tables and cards.
- Creators, vendors and fans share one system; the same visual language serves all three without forking the layout by role.
- Never fabricate content, numbers or proof to make a surface look fuller.

## Accessibility & Inclusion
- Dark-first interface must keep text contrast and focus states legible; motion respects reduced-motion preferences.
- Layouts must hold on phones, tablets and desktops.

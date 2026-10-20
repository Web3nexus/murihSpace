# Design

Status: proposed for the web dashboard redesign. Not yet approved by the user. Product truth lives in [PRODUCT.md](PRODUCT.md).

## Visual world: Immersive social

The dashboard reads like a social app built for a desktop screen: a dark, full-bleed canvas where the feed is the room. Content sits directly on the canvas, not inside stacked grey cards. Media runs edge to edge, the story rail and live rooms sit at the top like a stage, and the brand blue is the light source rather than a fill colour.

### Anti-references (what the old look is not)
- Equal-weight rectangular cards with hairline borders, stacked in a uniform grid.
- Panels inside panels, grey on grey, with every section boxed.
- Generic dashboard metrics tiles with no content behind them.

### Color
- Canvas: near-black blue, `#050E18` (page), with `#0B1C2E` for raised surfaces and `#12283D` for hover.
- Brand: `#2164b6` is the primary action and glow colour. A lighter tint `#4D8FE8` is used for focus rings and highlights on dark.
- Text: `#F5F8FB` primary, `#9FB3C4` secondary, `#5F7587` subtle. Body text meets WCAG AA on every surface.
- Status colours keep the existing tokens: success `#16A34A`, warning `#F59E0B`, danger `#DC2626`, info `#0EA5E9`.
- Light and dark are both first-class themes. Every feed surface reads from semantic `--feed-*` tokens defined for `:root` (light) and `.dark` in `web/frontend/src/styles/feed.css`, so no component hardcodes a surface or text colour. Light values keep the existing light palette (white surfaces, `#102840` text); dark values use the navy canvas above.
- Accent on dark is lifted to `#4D8FE8` for text and focus legibility. Solid buttons keep `#2164b6` with white text in both themes, so button contrast does not change.
- The community hero and gradient avatars are brand artwork and stay the same in both themes.

### Type
- Inter variable for UI and body, tight tracking on display sizes, tabular numerals for counts and money.

### Shape and depth
- Radii: 16px for media, 20px for sheets and composer, full pill for chips and reactions.
- Depth comes from the glow behind media and the blur of overlays, not from borders and shadows on every card.

### Layout
- Three zones on desktop: left navigation rail, a central feed column of about 640px, and a right rail for live rooms, suggestions and sponsored content.
- The feed column is the focal point. Posts have no outer box; each post is separated by spacing and a hairline divider.
- Stories and live rooms form a horizontal rail at the top of the feed.
- Below 1024px the right rail folds into the feed; below 768px the navigation becomes a bottom bar.

### Motion
- Short, purposeful transitions: reactions pop, live badges pulse slowly, media fades in. All motion is disabled under `prefers-reduced-motion`.

### Iconography
- Keep the current icon libraries (Lucide, Hugeicons) as chosen by the user. Never use sparkle or magic-wand icons.

### Brand note
- Brand blue is `#2164b6` everywhere (web, mobile, backend badge colour, rule files). The shared token file keeps its navy `#102840` for text and surfaces.

## Platform blend: what each product contributes

Taken as patterns, not logos or brand copy.

- **Facebook:** the top bar holds the search, notifications and messages; the feed is a single readable column; the left rail lists the user's places.
- **Instagram:** a stories rail with gradient rings at the top of the feed; a compact icon rail on tablets; clean media-first posts.
- **TikTok:** full-bleed vertical media and a bottom tab bar with a central create button; dark-first immersive viewing.
- **WhatsApp:** chats are the home for messaging: list on the left, conversation on the right, quick status checks.
- **Telegram:** dense, fast lists for chats and channels; clear unread badges; the desktop app keeps a two-pane layout.

## Shell tokens and migration status

The shell and the feed read from `--shell-*` tokens in `web/frontend/src/index.css` (`canvas`, `surface`, `subtle`, `hover`, `hover-strong`, `border`, `text`, `muted`, `accent`, `accent-solid`, `accent-hover`, `accent-tint`), defined for light and dark.

- **Done and checked in a browser (light and dark, desktop and phone):** sidebar, top header (phone layout fixed), bottom bar, community feed, wallet, login.
- **Done by mechanical migration, not yet visually checked page by page:** about 2,600 hardcoded colour literals and Tailwind default palette classes (`gray`, `slate`, `blue`, `neutral`) in roughly 120 files.
- **Still open:** about 713 hex literals and about 470 Tailwind palette classes. Most are contextual (dark cards and overlays, third-party brand colours such as Telegram and WhatsApp, gradient artwork) and need a page-by-page decision.
- **Not started:** the structural restyle to the Facebook/Instagram/TikTok/WhatsApp/Telegram patterns beyond the shell tokens.

## Mobile and desktop

- **Decided:** the desktop app is the Flutter project in `mobile/` (its `macos`, `windows` and `linux` platform folders already exist). Mobile and desktop share one codebase and one set of tokens.
- **Decided:** the web dashboard is the main product and the source of truth for layout and behaviour. Mobile and desktop follow the same brand and standards; they do not need a heavy visual redesign.
- **Mobile standards (done):** brand blue is `#2164b6` (`mobile/lib/core/design_tokens.dart`); the creator icon uses `Icons.workspace_premium_rounded` instead of `auto_awesome`; no sparkle icons remain in app UI.
- **Still open for mobile/desktop:** adopting the shell tokens and the WhatsApp/Telegram patterns for chat lists, and checking the desktop layouts on macOS, Windows and Linux.

## Scope and order

1. Shell: navigation rail, right rail, responsive bottom bar.
2. Live feed: stories and live rooms rail, post layout, composer, comments, sponsored placement.
3. Community feed and profile.
4. Messaging, events, store, wallet and studio pages, in that order.

Data wiring, role gating and route structure stay as they are.

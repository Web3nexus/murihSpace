import { useEffect, useRef, useState } from 'react';
import { emojiAssetUrl } from '@/lib/emoji';
import { cn } from '@/lib/utils';

interface AnimatedEmojiProps {
  emoji: string;
  /** Tailwind size utilities (e.g. "h-5 w-5"). Defaults to font-relative 1.25em. */
  className?: string;
  alt?: string;
  title?: string;
}

// 1×1 transparent GIF — decoded instantly (no animation frames) so off-screen
// emoji cost nothing until they scroll into view.
const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';

/**
 * Renders an emoji as its animated webp asset. Falls back to the plain text
 * glyph whenever the pack has no asset for it (e.g. skin-tone variants and
 * recently-added emoji), so the UI never shows a broken image.
 *
 * The animated webp pack ships ~750 KB, 45-frame files. Mounting a whole
 * category (100+ emoji) at once and animating them simultaneously pegs the CPU,
 * so we only start loading/animating an emoji once it is near the viewport.
 */
export function AnimatedEmoji({ emoji, className, alt, title }: AnimatedEmojiProps) {
  const url = emojiAssetUrl(emoji);
  const imgRef = useRef<HTMLImageElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = imgRef.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);

  // When the caller passes an explicit size utility (h-*, w-*, size-*) we must
  // NOT also emit the font-relative default, otherwise both classes target the
  // same CSS property and whichever Tailwind emits last wins — which made
  // explicitly-sized emoji (picker grid, jumbo messages) render tiny.
  const hasExplicitSize = !!className && /(^|\s)(h-|w-|size-)/.test(className);

  if (!url) {
    return (
      <span
        className={cn('inline-block align-[-0.15em]', className)}
        title={title}
        role="img"
        aria-label={alt ?? emoji}
      >
        {emoji}
      </span>
    );
  }
  return (
    <img
      ref={imgRef}
      src={inView ? url : TRANSPARENT_PIXEL}
      alt={alt ?? emoji}
      title={title}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn(
        'inline-block max-w-none object-contain align-[-0.2em] select-none',
        hasExplicitSize ? '' : 'h-[1.25em] w-auto',
        className
      )}
    />
  );
}

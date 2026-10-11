import { emojiAssetUrl } from '@/lib/emoji';
import { cn } from '@/lib/utils';

interface AnimatedEmojiProps {
  emoji: string;
  /** Tailwind size utilities (e.g. "h-5 w-5"). Defaults to font-relative 1.25em. */
  className?: string;
  alt?: string;
  title?: string;
}

/**
 * Renders an emoji as its animated webp asset. Falls back to the plain text
 * glyph whenever the pack has no asset for it (e.g. skin-tone variants and
 * recently-added emoji), so the UI never shows a broken image.
 */
export function AnimatedEmoji({ emoji, className, alt, title }: AnimatedEmojiProps) {
  const url = emojiAssetUrl(emoji);
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
      src={url}
      alt={alt ?? emoji}
      title={title}
      loading="lazy"
      draggable={false}
      className={cn(
        'inline-block h-[1.25em] w-auto max-w-none object-contain align-[-0.2em] select-none',
        className
      )}
    />
  );
}
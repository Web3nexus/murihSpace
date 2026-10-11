import { Fragment } from 'react';
import { EMOJI_REGEX } from '@/lib/emoji';
import { AnimatedEmoji } from '@/components/chat/AnimatedEmoji';

interface EmojiRichTextProps {
  text: string;
  className?: string;
}

/**
 * Renders a string with emoji replaced by their animated webp assets, keeping
 * the surrounding text as plain runs. `text.split(EMOJI_REGEX)` produces
 * [text, emoji, text, emoji, ...] where odd indexes are populated captures.
 *
 * Usage warning: do not put a <p> inside a <p>. Callers own the container.
 */
export function EmojiRichText({ text, className }: EmojiRichTextProps) {
  const parts = text.split(EMOJI_REGEX);
  if (parts.length <= 1) return <>{text}</>;

  return (
    <>
      {parts.map((part, idx) =>
        idx % 2 === 1 && part.length > 0 ? (
          <AnimatedEmoji key={`${idx}-${part}`} emoji={part} className={className} />
        ) : (
          <Fragment key={idx}>{part}</Fragment>
        )
      )}
    </>
  );
}
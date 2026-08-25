interface IOSTypingBubbleProps {
  names?: string[];
}

export function IOSTypingBubble({ names = [] }: IOSTypingBubbleProps) {
  return (
    <div className="flex items-end gap-2 px-2 py-1 animate-fade-in">
      <div className="relative flex items-center gap-1.5 px-4 py-2.5 rounded-2xl rounded-bl-sm bg-muted/80 dark:bg-[#102840] border border-border/40 shadow-xs">
        {/* iOS 3 Dots Wave Animation */}
        <div className="flex items-center gap-1">
          <span
            className="h-2 w-2 rounded-full bg-muted-foreground/70 dark:bg-white/70 animate-bounce"
            style={{ animationDelay: "0ms", animationDuration: "1s" }}
          />
          <span
            className="h-2 w-2 rounded-full bg-muted-foreground/70 dark:bg-white/70 animate-bounce"
            style={{ animationDelay: "200ms", animationDuration: "1s" }}
          />
          <span
            className="h-2 w-2 rounded-full bg-muted-foreground/70 dark:bg-white/70 animate-bounce"
            style={{ animationDelay: "400ms", animationDuration: "1s" }}
          />
        </div>
        {names.length > 0 && (
          <span className="text-[11px] font-medium text-muted-foreground ml-1">
            {names.join(", ")} {names.length === 1 ? "is" : "are"} typing...
          </span>
        )}
      </div>
    </div>
  );
}

export interface MappedError {
  category: 'livekit' | 'network' | 'auth' | 'chunk' | 'runtime' | 'not_found' | 'permission' | 'unknown';
  title: string;
  description: string;
  suggestion: string;
  iconType: 'livekit' | 'network' | 'auth' | 'chunk' | 'warning';
  badge: string;
  badgeVariant: 'warning' | 'info' | 'destructive' | 'neutral';
  canRetry: boolean;
  canGoHome: boolean;
  actionLabel: string;
  rawMessage: string;
  stack?: string;
}

export function mapApplicationError(error: unknown): MappedError {
  let rawMessage = "An unexpected error occurred.";
  let stack: string | undefined;

  if (typeof error === "string") {
    rawMessage = error;
  } else if (error && typeof error === "object") {
    if ("message" in error && typeof (error as any).message === "string") {
      rawMessage = (error as any).message;
    }
    if ("stack" in error && typeof (error as any).stack === "string") {
      stack = (error as any).stack;
    }
    if ("statusText" in error && typeof (error as any).statusText === "string") {
      rawMessage = `${(error as any).status || ""} ${(error as any).statusText}`.trim();
    }
  }

  const lower = rawMessage.toLowerCase();

  // 1. LiveKit / Video Conference Errors
  if (
    lower.includes("livekit") ||
    lower.includes("webrtc") ||
    lower.includes("tokenendpoint") ||
    lower.includes("failed to issue livekit token") ||
    lower.includes("could not connect to livekit") ||
    lower.includes("livekit_not_configured") ||
    lower.includes("meeting room")
  ) {
    return {
      category: "livekit",
      title: "Live Video Unavailable",
      description: "We're having trouble connecting to this live video session right now.",
      suggestion: "Please try rejoining the room or check back shortly.",
      iconType: "livekit",
      badge: "Video",
      badgeVariant: "warning",
      canRetry: true,
      canGoHome: true,
      actionLabel: "Try Again",
      rawMessage,
      stack,
    };
  }

  // 2. Dynamic Chunk / Build Update
  if (
    lower.includes("failed to fetch dynamically imported module") ||
    lower.includes("importing a module script failed") ||
    lower.includes("error loading dynamically imported module") ||
    lower.includes("chunkloaderror") ||
    lower.includes("loading chunk")
  ) {
    return {
      category: "chunk",
      title: "New Update Available",
      description: "MurihSpace has been updated with improvements and new features.",
      suggestion: "Tap below to refresh and load the latest version.",
      iconType: "chunk",
      badge: "Update",
      badgeVariant: "info",
      canRetry: true,
      canGoHome: true,
      actionLabel: "Refresh",
      rawMessage,
      stack,
    };
  }

  // 3. Authentication & Session Expired
  if (
    lower.includes("401") ||
    lower.includes("unauthenticated") ||
    lower.includes("session expired") ||
    lower.includes("token expired") ||
    lower.includes("jwt expired")
  ) {
    return {
      category: "auth",
      title: "Please Sign In",
      description: "Your session has expired. Please sign in again to continue.",
      suggestion: "Sign in with your account to access this page.",
      iconType: "auth",
      badge: "Sign In",
      badgeVariant: "warning",
      canRetry: false,
      canGoHome: true,
      actionLabel: "Sign In",
      rawMessage,
      stack,
    };
  }

  // 4. Forbidden / Access Restricted
  if (lower.includes("403") || lower.includes("unauthorized") || lower.includes("forbidden")) {
    return {
      category: "permission",
      title: "Content Unavailable",
      description: "This content isn't available right now, or you may not have permission to view it.",
      suggestion: "Make sure you have joined the space or head back to your feed.",
      iconType: "warning",
      badge: "Private",
      badgeVariant: "destructive",
      canRetry: false,
      canGoHome: true,
      actionLabel: "Go to Feed",
      rawMessage,
      stack,
    };
  }

  // 5. Network / Server Connection
  if (
    lower.includes("network error") ||
    lower.includes("failed to fetch") ||
    lower.includes("connection refused") ||
    lower.includes("err_connection_refused") ||
    lower.includes("operation not permitted") ||
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("504")
  ) {
    return {
      category: "network",
      title: "No Internet Connection",
      description: "Couldn't connect to MurihSpace. Please check your connection and try again.",
      suggestion: "Make sure Wi-Fi or mobile data is turned on.",
      iconType: "network",
      badge: "Offline",
      badgeVariant: "destructive",
      canRetry: true,
      canGoHome: true,
      actionLabel: "Try Again",
      rawMessage,
      stack,
    };
  }

  // 6. 404 Not Found
  if (lower.includes("404") || lower.includes("not found")) {
    return {
      category: "not_found",
      title: "This Page Isn't Available",
      description: "The link you followed may be broken, or the page may have been removed.",
      suggestion: "Go back to your feed to discover more content.",
      iconType: "warning",
      badge: "Not Found",
      badgeVariant: "neutral",
      canRetry: false,
      canGoHome: true,
      actionLabel: "Go to Feed",
      rawMessage,
      stack,
    };
  }

  // 7. JavaScript Runtime / Data Mapping
  if (
    lower.includes("is not a function") ||
    lower.includes("cannot read properties of") ||
    lower.includes("undefined is not an object") ||
    lower.includes("null is not an object") ||
    lower.includes("rendered fewer hooks than expected")
  ) {
    return {
      category: "runtime",
      title: "Something went wrong",
      description: "We're having trouble loading this right now. Please try again in a moment.",
      suggestion: "Reloading usually resolves this.",
      iconType: "warning",
      badge: "Notice",
      badgeVariant: "warning",
      canRetry: true,
      canGoHome: true,
      actionLabel: "Try Again",
      rawMessage,
      stack,
    };
  }

  // Default fallback
  return {
    category: "unknown",
    title: "Something went wrong",
    description: "We're having trouble loading this page right now. Please try again or head back to your feed.",
    suggestion: "Reload the page or navigate home.",
    iconType: "warning",
    badge: "Notice",
    badgeVariant: "warning",
    canRetry: true,
    canGoHome: true,
    actionLabel: "Try Again",
    rawMessage,
    stack,
  };
}

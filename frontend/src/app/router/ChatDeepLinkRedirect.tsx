import { Navigate, useParams } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { BrandPreloader } from "@/components/common/BrandPreloader";
import { sanitiseReturnTo } from "@/lib/deepLinks";

/**
 * Resolves a shared chat link (`/chat/:conversationId`).
 *
 * A conversation is private, so this is a pure redirect rather than a page:
 * authenticated visitors land on the message thread, and everyone else goes
 * through login first and is returned to the same thread afterwards. The
 * `next` value is sanitised so only known in-app destinations survive.
 */
export function ChatDeepLinkRedirect() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <BrandPreloader fullScreen message="Loading MurihSpace…" />;

  const target = `/app/messages?conversation=${encodeURIComponent(id ?? "")}`;
  const safeTarget = sanitiseReturnTo(target) ?? "/app/messages";

  if (!isAuthenticated) {
    return <Navigate to={`/login?next=${encodeURIComponent(safeTarget)}`} replace />;
  }

  return <Navigate to={safeTarget} replace />;
}
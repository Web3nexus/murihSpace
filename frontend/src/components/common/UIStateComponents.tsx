import React from "react";
import { Loader2, Inbox, AlertCircle, ShieldOff, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Shared Base Component
// ─────────────────────────────────────────────────────────────
interface StateContainerProps {
  children: React.ReactNode;
  className?: string;
}

const StateContainer: React.FC<StateContainerProps> = ({ children, className }) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center gap-4 py-16 px-6 text-center",
      className
    )}
    role="status"
    aria-live="polite"
  >
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────
// Loading State
// ─────────────────────────────────────────────────────────────
interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Loading…",
  className,
}) => (
  <StateContainer className={className}>
    <Loader2 className="h-10 w-10 animate-spin text-primary/60" aria-hidden="true" />
    <p className="text-sm text-muted-foreground font-medium">{message}</p>
  </StateContainer>
);

// ─────────────────────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────────────────────
interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  icon?: React.ElementType;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = "Nothing here yet",
  description = "There is no content to display right now.",
  action,
  icon: Icon = Inbox,
  className,
}) => (
  <StateContainer className={className}>
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
      <Icon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
    </div>
    <div>
      <p className="font-semibold text-base">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
    {action && (
      action.href ? (
        <Button asChild size="sm" id="empty-state-action">
          <Link to={action.href}>{action.label}</Link>
        </Button>
      ) : (
        <Button size="sm" onClick={action.onClick} id="empty-state-action">
          {action.label}
        </Button>
      )
    )}
  </StateContainer>
);

// ─────────────────────────────────────────────────────────────
// Error State
// ─────────────────────────────────────────────────────────────
interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again.",
  onRetry,
  className,
}) => (
  <StateContainer className={className}>
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
      <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
    </div>
    <div>
      <p className="font-semibold text-base">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry} id="error-retry-btn">
        Try again
      </Button>
    )}
  </StateContainer>
);

// ─────────────────────────────────────────────────────────────
// Permission Denied State
// ─────────────────────────────────────────────────────────────
interface PermissionDeniedStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export const PermissionDeniedState: React.FC<PermissionDeniedStateProps> = ({
  title = "Access restricted",
  description = "You do not have permission to view this content. Upgrade your role or contact an admin.",
  className,
}) => (
  <StateContainer className={className}>
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
      <ShieldOff className="h-8 w-8 text-amber-500" aria-hidden="true" />
    </div>
    <div>
      <p className="font-semibold text-base">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
    <Button asChild variant="outline" size="sm" id="permission-denied-settings">
      <Link to="/app/settings">Manage Account</Link>
    </Button>
  </StateContainer>
);

// ─────────────────────────────────────────────────────────────
// Not Found State
// ─────────────────────────────────────────────────────────────
interface NotFoundStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export const NotFoundState: React.FC<NotFoundStateProps> = ({
  title = "Page not found",
  description = "The page you are looking for does not exist or may have been moved.",
  className,
}) => (
  <StateContainer className={className}>
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
      <FileSearch className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
    </div>
    <div>
      <p className="font-semibold text-base">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
    <Button asChild size="sm" id="not-found-home-btn">
      <Link to="/">Go to Home</Link>
    </Button>
  </StateContainer>
);

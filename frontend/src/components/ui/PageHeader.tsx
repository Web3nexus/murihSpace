import React from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon,
  badge,
  action,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          {badge}
        </div>
        <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
          {icon && <span className="text-secondary">{icon}</span>}
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="shrink-0 flex items-center gap-3">
          {action}
        </div>
      )}
    </div>
  );
};

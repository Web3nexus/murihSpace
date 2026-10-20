import React from "react";
import { Link, useLocation } from "react-router";

export interface PageNavTab {
  id?: string;
  label: string;
  href?: string;
  count?: number;
  badge?: string | number;
  icon?: React.ReactNode;
  exact?: boolean;
  onClick?: () => void;
}

interface PageSecondaryNavProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  tabs: PageNavTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  actions?: React.ReactNode;
  className?: string;
}

export function PageSecondaryNav({
  title,
  subtitle,
  icon,
  tabs,
  activeTab,
  onTabChange,
  actions,
  className = "",
}: PageSecondaryNavProps) {
  const { pathname, search } = useLocation();

  const isTabActive = (tab: PageNavTab): boolean => {
    const tabId = tab.id ?? tab.href ?? tab.label;
    if (activeTab != null) {
      return activeTab === tabId;
    }
    if (tab.href) {
      if (tab.href.includes("?")) {
        return pathname + search === tab.href;
      }
      if (tab.exact) {
        return pathname === tab.href;
      }
      return pathname === tab.href || pathname.startsWith(tab.href + "/");
    }
    return false;
  };

  return (
    <div
      className={`w-full bg-white dark:bg-[var(--shell-surface)] border-b border-[var(--shell-border)] dark:border-[var(--shell-border)] sticky top-0 z-10 shadow-2xs ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {(title || actions) && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 pb-2">
            {title && (
              <div className="flex items-center gap-2.5">
                {icon && (
                  <span className="h-8 w-8 rounded-lg bg-[var(--shell-accent-solid)]/10 text-[var(--shell-accent)] dark:text-[var(--shell-accent)] flex items-center justify-center shrink-0">
                    {icon}
                  </span>
                )}
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--shell-text)] dark:text-[var(--shell-text)]">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                  )}
                </div>
              </div>
            )}
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
          </div>
        )}

        {/* Tab Navigation */}
        <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar pt-1">
          {tabs.map((tab) => {
            const active = isTabActive(tab);
            const content = (
              <>
                {tab.icon && <span className="shrink-0 text-[18px]">{tab.icon}</span>}
                <span>{tab.label}</span>
                {(tab.count != null || tab.badge != null) && (
                  <span
                    className={`h-5 min-w-[20px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center leading-none ${
                      active
                        ? "bg-[var(--shell-accent-solid)] text-white"
                        : "bg-[var(--shell-border)] dark:bg-[var(--shell-border)] text-foreground"
                    }`}
                  >
                    {tab.count != null ? (tab.count > 99 ? "99+" : tab.count) : tab.badge}
                  </span>
                )}
                {active && (
                  <span className="absolute bottom-0 left-2 right-2 h-[2.5px] bg-[var(--shell-accent-solid)] dark:bg-[var(--shell-accent)] rounded-t-full" />
                )}
              </>
            );

            const tabKey = tab.id ?? tab.href ?? tab.label;
            const tabClasses = `relative flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold rounded-md transition-all whitespace-nowrap select-none cursor-pointer ${
              active
                ? "text-[var(--shell-accent)] dark:text-[var(--shell-accent)] bg-[var(--shell-accent-solid)]/10 dark:bg-[var(--shell-accent-solid)]/20 font-bold"
                : "text-muted-foreground hover:text-[var(--shell-text)] dark:hover:text-[var(--shell-text)] hover:bg-black/5 dark:hover:bg-white/5"
            }`;

            if (tab.href) {
              return (
                <Link
                  key={tabKey}
                  to={tab.href}
                  onClick={tab.onClick}
                  className={tabClasses}
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={tabKey}
                type="button"
                onClick={() => {
                  tab.onClick?.();
                  onTabChange?.(tabKey);
                }}
                className={tabClasses}
              >
                {content}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}


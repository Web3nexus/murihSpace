import React from "react";
import { Bell, Search, Sun, Moon, ChevronDown, User, LogOut, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserRole } from "./Sidebar";
import { cn } from "@/lib/utils";

const ROLES: UserRole[] = ["member", "creator", "vendor", "admin"];

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  isDark,
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md gap-4">
      {/* Left: Search */}
      <div className="flex flex-1 items-center gap-3 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search MurihSpace..."
            className={cn(
              "h-9 w-full rounded-md border border-input bg-muted/40 pl-9 pr-4",
              "text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            )}
            aria-label="Search"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Role Switcher (Sprint 2 dev preview) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-9 text-xs capitalize font-medium" id="role-switcher">
              <span className="hidden sm:inline text-muted-foreground">Role:</span>
              <span className="text-primary font-semibold capitalize">{currentRole}</span>
              <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {ROLES.map((role) => (
              <DropdownMenuItem
                key={role}
                onClick={() => onRoleChange(role)}
                className={cn(
                  "capitalize text-sm cursor-pointer",
                  role === currentRole && "bg-primary/10 text-primary font-semibold"
                )}
              >
                {role}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications" id="notifications-btn">
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={onToggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          id="theme-toggle"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 pl-2 pr-3 h-9"
              id="user-menu"
              aria-label="User menu"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold text-xs">
                VN
              </div>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-3 py-2 text-sm">
              <p className="font-medium">Vincent N.</p>
              <p className="text-xs text-muted-foreground">vincent@murihspace.com</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 cursor-pointer" id="profile-link">
              <User className="h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive" id="logout-btn">
              <LogOut className="h-4 w-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

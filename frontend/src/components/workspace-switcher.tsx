import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { ChevronsUpDownIcon, PlusIcon, ShieldAlert } from "lucide-react";

interface Workspace {
  name: string;
  plan: string;
  icon: string;
}

interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  /** When true, shows an Admin badge instead of regular plan label */
  isAdmin?: boolean;
}

export function WorkspaceSwitcher({
  workspaces,
  isAdmin = false,
}: WorkspaceSwitcherProps) {
  const { isMobile } = useSidebar();
  const [active, setActive] = React.useState(workspaces[0]);

  if (!active) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {/* Brand mark / workspace icon */}
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
                {isAdmin ? (
                  <ShieldAlert className="size-4" />
                ) : (
                  active.icon
                )}
              </div>

              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{active.name}</span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {isAdmin ? "Platform Administrator" : active.plan}
                </span>
              </div>

              <ChevronsUpDownIcon className="ml-auto size-4 shrink-0" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-64"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5">
              Workspaces
            </DropdownMenuLabel>

            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.name}
                onClick={() => setActive(ws)}
                className="gap-3 p-2 cursor-pointer"
              >
                <div className="flex size-8 items-center justify-center rounded-md border border-border bg-sidebar-accent text-sidebar-accent-foreground font-bold text-sm shrink-0">
                  {ws.icon}
                </div>
                <div className="grid text-sm">
                  <span className="font-medium">{ws.name}</span>
                  <span className="text-xs text-muted-foreground">{ws.plan}</span>
                </div>
                {ws.name === active.name && (
                  <span className="ml-auto text-xs text-secondary font-semibold">Active</span>
                )}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuItem className="gap-3 p-2 cursor-pointer text-muted-foreground">
              <div className="flex size-8 items-center justify-center rounded-md border border-dashed border-border bg-transparent shrink-0">
                <PlusIcon className="size-4" />
              </div>
              <span className="font-medium">Create Community</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

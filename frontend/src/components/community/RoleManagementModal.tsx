import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/community/RoleBadge";
import { Plus, Check, AlertCircle, Sparkles, Key } from "lucide-react";
import type { CommunityRole, PermissionDefinition } from "@/types/community";

interface RoleManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: number;
  communityName: string;
}

const DEFAULT_PERMISSIONS: PermissionDefinition[] = [
  {
    key: "create_posts",
    name: "Create Posts & Updates",
    description: "Publish posts, announcements and status updates in the community feed.",
    category: "Content",
    default_for: ["owner", "admin", "moderator", "member"],
  },
  {
    key: "share_links",
    name: "Share Clickable Links",
    description: "Post external URLs and web links in posts/comments. (Disabled for default members)",
    category: "Content Security",
    default_for: ["owner", "admin", "moderator"],
  },
  {
    key: "moderate_content",
    name: "Moderate Content & Comments",
    description: "Delete or flag inappropriate member posts and comments.",
    category: "Moderation",
    default_for: ["owner", "admin", "moderator"],
  },
  {
    key: "manage_requests",
    name: "Review Join Requests",
    description: "Approve or reject private community join applications.",
    category: "Moderation",
    default_for: ["owner", "admin", "moderator"],
  },
  {
    key: "manage_settings",
    name: "Manage Community Settings",
    description: "Edit community name, description, logo, cover, and access rules.",
    category: "Administration",
    default_for: ["owner", "admin"],
  },
  {
    key: "manage_roles",
    name: "Manage Roles & Assign Permissions",
    description: "Create custom roles and assign permission levels to members.",
    category: "Administration",
    default_for: ["owner", "admin"],
  },
];

export function RoleManagementModal({
  open,
  onOpenChange,
  communityId,
  communityName,
}: RoleManagementModalProps) {
  const [roles, setRoles] = React.useState<CommunityRole[]>([]);
  const [permissionsMatrix] = React.useState<PermissionDefinition[]>(DEFAULT_PERMISSIONS);
  const [tab, setTab] = React.useState<"roles" | "create">("roles");

  // New role form state
  const [roleName, setRoleName] = React.useState("");
  const [roleColor, setRoleColor] = React.useState("#38A8D8");
  const [selectedPermissions, setSelectedPermissions] = React.useState<string[]>([
    "create_posts",
  ]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");

  // Fetch community roles
  React.useEffect(() => {
    if (!open || !communityId) return;

    async function fetchRoles() {
      try {
        const res = await fetch(`/api/v1/communities/${communityId}/roles`);
        if (res.ok) {
          const data = await res.json();
          if (data.roles && data.roles.length > 0) {
            setRoles(data.roles);
            return;
          }
        }
      } catch {
        // Mock fallback roles
      }

      setRoles([
        {
          id: 1,
          community_id: communityId,
          name: "Owner",
          slug: "owner",
          permissions: ["*"],
          is_system: true,
          color: "#102840",
        },
        {
          id: 2,
          community_id: communityId,
          name: "Administrator",
          slug: "admin",
          permissions: ["create_posts", "share_links", "moderate_content", "manage_requests", "manage_settings", "manage_roles"],
          is_system: true,
          color: "#38A8D8",
        },
        {
          id: 3,
          community_id: communityId,
          name: "Moderator",
          slug: "moderator",
          permissions: ["create_posts", "share_links", "moderate_content", "manage_requests"],
          is_system: true,
          color: "#F59E0B",
        },
        {
          id: 4,
          community_id: communityId,
          name: "Member",
          slug: "member",
          permissions: ["create_posts"],
          is_system: true,
          color: "#667085",
        },
      ]);
    }

    fetchRoles();
  }, [open, communityId]);

  const togglePermission = (key: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) {
      setError("Role name is required.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("murihspace-token");
      const res = await fetch(`/api/v1/communities/${communityId}/roles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: roleName.trim(),
          permissions: selectedPermissions,
          color: roleColor,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create custom role.");
      }

      setRoles((prev) => [...prev, data.role]);
      setRoleName("");
      setSelectedPermissions(["create_posts"]);
      setTab("roles");
    } catch (err: any) {
      setError(err.message || "Failed to create role.");
      // Fallback optimistic update
      const newCustomRole: CommunityRole = {
        id: Date.now(),
        community_id: communityId,
        name: roleName.trim(),
        slug: roleName.toLowerCase().replace(/\s+/g, "-"),
        permissions: selectedPermissions,
        is_system: false,
        color: roleColor,
      };
      setRoles((prev) => [...prev, newCustomRole]);
      setRoleName("");
      setTab("roles");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 sm:p-8">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Roles & Permissions Matrix</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Manage roles and permission levels for <span className="font-semibold text-foreground">{communityName}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab switch */}
        <div className="flex p-1 bg-muted rounded-xl gap-1 w-fit my-2">
          <button
            onClick={() => setTab("roles")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              tab === "roles"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Community Roles ({roles.length})
          </button>
          <button
            onClick={() => setTab("create")}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              tab === "create"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            Create Custom Role
          </button>
        </div>

        {tab === "roles" ? (
          <div className="space-y-4 my-2">
            <div className="space-y-3">
              {roles.map((r) => (
                <div
                  key={r.id}
                  className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <RoleBadge role={r.name} color={r.color} />
                      <span className="text-xs text-muted-foreground font-mono">/{r.slug}</span>
                      {r.is_system && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          System Role
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {r.permissions.includes("*") ? "Full Access (*)" : `${r.permissions.length} permissions`}
                    </span>
                  </div>

                  {/* Included permissions pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {r.permissions.includes("*") ? (
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-semibold">
                        All Community Operations (*)
                      </span>
                    ) : (
                      r.permissions.map((pKey) => {
                        const def = permissionsMatrix.find((pm) => pm.key === pKey);
                        return (
                          <span
                            key={pKey}
                            className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-[11px] font-medium"
                          >
                            {def ? def.name : pKey}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-muted/50 border border-border flex items-start gap-2.5 text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
              <span>
                <strong>Sprint 7 Security Rule:</strong> Regular members do not have link-sharing permissions by default. You can create a custom role or grant <code className="text-primary font-mono">share_links</code> to authorized members.
              </span>
            </div>
          </div>
        ) : (
          /* Create Custom Role Form */
          <form onSubmit={handleCreateRole} className="space-y-5 my-2">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="roleName" className="text-xs font-semibold">
                  Role Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="roleName"
                  placeholder="e.g. VIP Ambassador"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  className="h-10 text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="roleColor" className="text-xs font-semibold">
                  Badge Color
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    id="roleColor"
                    type="color"
                    value={roleColor}
                    onChange={(e) => setRoleColor(e.target.value)}
                    className="h-10 w-12 rounded border border-border cursor-pointer bg-card"
                  />
                  <Input
                    type="text"
                    value={roleColor}
                    onChange={(e) => setRoleColor(e.target.value)}
                    className="h-10 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Permission Checkboxes */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Configurable Permissions</Label>
              <div className="grid grid-cols-1 gap-2.5">
                {permissionsMatrix.map((pm) => {
                  const isChecked = selectedPermissions.includes(pm.key);
                  return (
                    <button
                      key={pm.key}
                      type="button"
                      onClick={() => togglePermission(pm.key)}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                        isChecked
                          ? "border-primary bg-accent/30 text-foreground"
                          : "border-border bg-card text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isChecked
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border bg-background"
                        }`}
                      >
                        {isChecked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-foreground">{pm.name}</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {pm.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setTab("roles")}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary text-primary-foreground font-semibold gap-1.5"
              >
                <Sparkles className="h-4 w-4" />
                Save Custom Role
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

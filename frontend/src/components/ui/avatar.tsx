import * as React from "react"
import { cn } from "@/lib/utils"
import { Avatar as AvatarPrimitive } from "radix-ui"

function Avatar({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: "default" | "sm" | "lg" | "xl"
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=xl]:size-12 data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full rounded-full object-cover",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground group-data-[size=sm]/avatar:text-xs",
        className
      )}
      {...props}
    />
  )
}

interface AvatarBadgeProps extends React.ComponentProps<"span"> {
  status?: "active" | "inactive" | "online" | "offline"
  active?: boolean
}

function AvatarBadge({
  className,
  status,
  active,
  ...props
}: AvatarBadgeProps) {
  const resolvedStatus = status ?? (active !== undefined ? (active ? "active" : "inactive") : undefined)

  const statusClasses =
    resolvedStatus === "active" || resolvedStatus === "online"
      ? "bg-[#34C759] text-white shadow-xs ring-[#34C759]/30"
      : resolvedStatus === "inactive" || resolvedStatus === "offline"
      ? "bg-muted-foreground/40 text-transparent"
      : "bg-primary text-primary-foreground"

  return (
    <span
      data-slot="avatar-badge"
      data-status={resolvedStatus}
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full ring-2 ring-background select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        "group-data-[size=xl]/avatar:size-3.5 group-data-[size=xl]/avatar:[&>svg]:size-2.5",
        statusClasses,
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

interface UserAvatarProps extends Omit<React.ComponentProps<typeof AvatarPrimitive.Root>, "children"> {
  name?: string
  src?: string | null
  size?: "default" | "sm" | "lg" | "xl" | number
  status?: "active" | "inactive" | "online" | "offline"
  isActive?: boolean
  showStatus?: boolean
  fallbackClassName?: string
}

function UserAvatar({
  name,
  src,
  size = "default",
  status,
  isActive,
  showStatus = false,
  className,
  fallbackClassName,
  style,
  ...props
}: UserAvatarProps) {
  const resolvedStatus =
    status ??
    (isActive !== undefined ? (isActive ? "active" : "inactive") : undefined)
  const shouldShowStatus = showStatus || resolvedStatus !== undefined

  const initials = name
    ? name
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : ""

  const isNumericSize = typeof size === "number"
  const standardSize = isNumericSize ? "default" : size
  const customStyle: React.CSSProperties = isNumericSize
    ? { width: size, height: size, minWidth: size, minHeight: size, ...style }
    : (style ?? {})

  return (
    <Avatar
      size={standardSize}
      className={cn(isNumericSize ? "size-auto" : "", className)}
      style={customStyle}
      {...props}
    >
      {src && <AvatarImage src={src} alt={name || "User"} />}
      <AvatarFallback className={fallbackClassName}>
        {initials || <span className="text-[10px]">•</span>}
      </AvatarFallback>
      {shouldShowStatus && resolvedStatus && (
        <AvatarBadge status={resolvedStatus} />
      )}
    </Avatar>
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
  UserAvatar,
}

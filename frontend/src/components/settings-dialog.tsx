"use client"

import * as React from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import {
  Bell as BellIcon,
  List as MenuIcon,
  House as HomeIcon,
  PaintBrush as PaintbrushIcon,
  ChatCircle as MessageCircleIcon,
  Globe as GlobeIcon,
  Keyboard as KeyboardIcon,
  Check as CheckIcon,
  VideoCamera as VideoIcon,
  Link as LinkIcon,
  Lock as LockIcon,
  Gear as SettingsIcon
} from "@phosphor-icons/react";

const data = {
  nav: [
    {
      name: "Notifications",
      icon: (
        <BellIcon weight="fill"
        />
      ),
    },
    {
      name: "Navigation",
      icon: (
        <MenuIcon weight="fill"
        />
      ),
    },
    {
      name: "Home",
      icon: (
        <HomeIcon weight="fill"
        />
      ),
    },
    {
      name: "Appearance",
      icon: (
        <PaintbrushIcon weight="fill"
        />
      ),
    },
    {
      name: "Messages & media",
      icon: (
        <MessageCircleIcon weight="fill"
        />
      ),
    },
    {
      name: "Language & region",
      icon: (
        <GlobeIcon weight="fill"
        />
      ),
    },
    {
      name: "Accessibility",
      icon: (
        <KeyboardIcon weight="fill"
        />
      ),
    },
    {
      name: "Mark as read",
      icon: (
        <CheckIcon weight="fill"
        />
      ),
    },
    {
      name: "Audio & video",
      icon: (
        <VideoIcon weight="fill"
        />
      ),
    },
    {
      name: "Connected accounts",
      icon: (
        <LinkIcon weight="fill"
        />
      ),
    },
    {
      name: "Privacy & visibility",
      icon: (
        <LockIcon weight="fill"
        />
      ),
    },
    {
      name: "Advanced",
      icon: (
        <SettingsIcon weight="fill"
        />
      ),
    },
  ],
}

export function SettingsDialog() {
  const [open, setOpen] = React.useState(true)
  const [selectedSetting, setSelectedSetting] = React.useState("General")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Open Dialog</Button>
      </DialogTrigger>
      <DialogContent className="overflow-hidden p-0 md:max-h-[500px] md:max-w-[700px] lg:max-w-[800px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Customize your settings here.
        </DialogDescription>
        <SidebarProvider className="items-start">
          <Sidebar collapsible="none" className="hidden md:flex">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {data.nav.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          asChild
                          isActive={selectedSetting === item.name}
                        >
                          <button type="button" onClick={() => setSelectedSetting(item.name)}>
                            {item.icon}
                            <span>{item.name}</span>
                          </button>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex h-[480px] flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-2 px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbPage>Settings</BreadcrumbPage>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>Messages & media</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-video max-w-3xl rounded-lg bg-muted/50"
                />
              ))}
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}

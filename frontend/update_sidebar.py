import re

with open('src/components/app-sidebar.tsx', 'r') as f:
    content = f.read()

# Fix NavIconBadge to be purely the icon, sizing it properly
# Replace the NavIconBadge function block
new_badge = '''function NavIconBadge({ icon, active }: { icon: React.ReactNode, active?: boolean }) {
  return (
    <span className={`inline-flex items-center justify-center transition-transform group-hover/item:scale-105 shrink-0 ${active ? "text-primary" : "text-muted-foreground group-hover/item:text-foreground"}`}>
      {icon}
    </span>
  );
}'''

content = re.sub(
    r'function NavIconBadge\([^)]+\) {\n  return \([\s\S]+?\);\n}',
    new_badge,
    content
)

# Fix SidebarMenuButton classes in NavRow
# Inactive: neutral text, hover surface
# Active: subtle blue-tinted background
active_classes = "data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-bold"
new_classes = 'className="relative group/item h-[42px] gap-3 rounded-lg px-3 text-[14px] font-medium text-muted-foreground transition-all duration-150 hover:bg-muted/50 hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-semibold"'
content = re.sub(
    r'className="relative group/item h-10 gap-3 rounded-xl px-2.5 text-\[13px\] font-medium[^"]+"',
    new_classes,
    content
)

# Remove the bg-primary/10 text-primary circle logic by updating callers
content = content.replace('NavIconBadge icon={item.icon} />', 'NavIconBadge icon={item.icon} active={active} />')

# Remove the right border from Sidebar
content = content.replace('className="border-r border-border bg-card"', 'className="border-r-0 bg-sidebar"')
content = content.replace('className="h-14 flex items-center justify-center border-b border-border/80 px-4"', 'className="h-14 flex items-center justify-center px-4 border-b border-border/40"')
content = content.replace('className="border-t border-border/80 p-2"', 'className="border-t border-border/40 p-2"')

with open('src/components/app-sidebar.tsx', 'w') as f:
    f.write(content)

print("Updated app-sidebar styles")

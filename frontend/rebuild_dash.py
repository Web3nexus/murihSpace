import re

with open('src/components/layout/DashboardLayout.tsx', 'r') as f:
    content = f.read()

content = content.replace('import { Sparkles, X } from "lucide-react";', 'import { Sparkle, X } from "@phosphor-icons/react";')
content = content.replace('<Sparkles ', '<Sparkle weight="fill" ')
content = content.replace('<X ', '<X weight="bold" ')

# Let's fix the layout to replace SidebarInset with a normal grid layout
# Actually, the user wants "SIDEBAR MAIN CONTENT RIGHT CONTEXT". The right context is handled per page (like AppPage).
# I'll just change SidebarInset to not use `md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2` styles by using raw <main> instead if we wanted to rip it out. 
# But it's already using SidebarInset. Wait, SidebarInset might add weird margins.
# I'll let SidebarInset stay, because `app-sidebar` handles the collapse state.
# But I need to remove `SidebarInset` classes from `sidebar.tsx` or override it.
# Actually I already did `sed -i '' 's/md:peer-data-\[variant=inset\]:m-2...`

with open('src/components/layout/DashboardLayout.tsx', 'w') as f:
    f.write(content)


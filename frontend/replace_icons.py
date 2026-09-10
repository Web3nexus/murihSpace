import os
import re
import glob

nav_files = glob.glob('src/navigation/*.tsx') + ['src/components/app-sidebar.tsx', 'src/components/site-header.tsx']

replacements = {
    'LayoutDashboard': 'House',
    'Rss': 'Article',
    'Video': 'VideoCamera',
    'MessageCircle': 'ChatCircle',
    'MessageSquare': 'ChatTeardropText',
    'LifeBuoy': 'Lifebuoy',
    'ChevronsUpDown': 'CaretUpDown',
    'LogOut': 'SignOut',
    'ChevronRight': 'CaretRight',
    'Plus': 'Plus',
    'FileText': 'FileText',
    'Search': 'MagnifyingGlass',
    'X': 'X',
    'ArrowLeft': 'ArrowLeft',
    'MoreVertical': 'DotsThreeVertical',
    'MoreHorizontal': 'DotsThree',
    'Settings': 'Gear',
    'Image': 'Image',
    'Paperclip': 'Paperclip',
    'Send': 'PaperPlaneRight',
    'Smile': 'Smiley',
    'Mic': 'Microphone',
    'Menu': 'List',
    'Bookmark': 'BookmarkSimple',
    'Check': 'Check',
    'Edit': 'PencilSimple',
    'Trash': 'Trash',
    'Copy': 'Copy',
    'Share': 'ShareNetwork'
}

for filepath in nav_files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Replace lucide-react with @phosphor-icons/react
    content = content.replace('"lucide-react"', '"@phosphor-icons/react"')
    
    # Replace specific icon names
    for old, new in replacements.items():
        # Only replace exact words
        content = re.sub(r'\b' + old + r'\b', new, content)
    
    # Add weight="fill" to all JSX tags that look like icons
    # An icon is any capitalized tag imported from phosphor
    # We can just add weight="fill" to ALL imported icons.
    # Let's extract the imports first.
    match = re.search(r'import\s+{([^}]+)}\s+from\s+"@phosphor-icons/react"', content)
    if match:
        imported_icons = [icon.strip() for icon in match.group(1).split(',')]
        imported_icons = [icon for icon in imported_icons if icon]
        for icon in imported_icons:
            if icon:
                # Replace <Icon className=...> with <Icon weight="fill" className=...>
                # Also replace <Icon /> with <Icon weight="fill" />
                content = re.sub(rf'<{icon}\b(?!.*weight="fill")', rf'<{icon} weight="fill"', content)
    
    with open(filepath, 'w') as f:
        f.write(content)

print("Replaced icons in nav files")

import os
import re

missing_map = {
    'Sparkles': 'Sparkle',
    'UploadCloud': 'CloudArrowUp',
    'ShieldAlert': 'ShieldWarning',
    'Mail': 'Envelope',
    'MousePointerClick': 'CursorClick',
    'ListOrdered': 'ListNumbers',
    'PowerOff': 'Power',
    'Settings2': 'SlidersHorizontal',
    'MoveDown': 'ArrowDown',
    'UserX': 'UserMinus',
    'History': 'ClockCounterClockwise',
    'Link2': 'Link',
    'Film': 'FilmStrip',
    'Store': 'Storefront',
    'TrendingDown': 'TrendDown',
    'SendHorizonal': 'PaperPlaneRight',
    'MessageSquareText': 'ChatText',
    'RefreshCcw': 'ArrowsClockwise',
    'Server': 'HardDrives',
    'Ban': 'Prohibit',
    'LogIn': 'SignIn',
    'Banknote': 'Money',
    'ScrollText': 'Scroll',
    'FileCheck': 'FileText',
    'LifeBuoy': 'Lifebuoy',
    'Save': 'FloppyDisk',
    'Wand2': 'MagicWand'
}

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()

            modified = False
            # Check if any missing import is in the file
            for old, new in missing_map.items():
                if f' {old},' in content or f' {old} ' in content or f',{old}' in content or f'<{old}' in content:
                    # It's safer to just replace word boundaries
                    content = re.sub(rf'\b{old}\b', new, content)
                    modified = True
            
            if modified:
                with open(path, 'w') as f:
                    f.write(content)

print("Remaining icons fixed.")

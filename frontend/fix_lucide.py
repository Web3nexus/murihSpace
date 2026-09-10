import os
import re

mapping = {
    'MessageSquare': 'ChatTeardropText',
    'MessageCircle': 'ChatCircle',
    'TrendingUp': 'TrendUp',
    'Smartphone': 'DeviceMobile',
    'Inbox': 'Tray',
    'Activity': 'Waveform',
    'Video': 'VideoCamera',
    'BarChart2': 'ChartBar',
    'BarChart3': 'ChartBar',
    'Share2': 'ShareNetwork',
    'MoreHorizontal': 'DotsThree',
    'MoreVertical': 'DotsThreeVertical',
    'ChevronRight': 'CaretRight',
    'ChevronLeft': 'CaretLeft',
    'ChevronDown': 'CaretDown',
    'ChevronUp': 'CaretUp',
    'ChevronsUpDown': 'CaretUpDown',
    'BadgeCheck': 'SealCheck',
    'Send': 'PaperPlaneRight',
    'Loader2': 'Spinner',
    'AlertCircle': 'WarningCircle',
    'AlertTriangle': 'Warning',
    'Search': 'MagnifyingGlass',
    'Settings': 'Gear',
    'LogOut': 'SignOut',
    'Edit': 'Pencil',
    'Edit2': 'PencilSimple',
    'Edit3': 'PencilSimple',
    'Trash': 'Trash',
    'Trash2': 'Trash',
    'Folder': 'Folder',
    'File': 'File',
    'FileText': 'FileText',
    'Image': 'Image',
    'Camera': 'Camera',
    'Music': 'MusicNote',
    'Play': 'Play',
    'Pause': 'Pause',
    'Volume2': 'SpeakerHigh',
    'VolumeX': 'SpeakerNone',
    'Mic': 'Microphone',
    'MicOff': 'MicrophoneSlash',
    'MapPin': 'MapPin',
    'Globe': 'Globe',
    'Link': 'Link',
    'ExternalLink': 'ArrowSquareOut',
    'Download': 'DownloadSimple',
    'Upload': 'UploadSimple',
    'Cloud': 'Cloud',
    'Lock': 'Lock',
    'Unlock': 'LockOpen',
    'Shield': 'Shield',
    'ShieldCheck': 'ShieldCheck',
    'Eye': 'Eye',
    'EyeOff': 'EyeSlash',
    'Menu': 'List',
    'X': 'X',
    'Plus': 'Plus',
    'Minus': 'Minus',
    'Check': 'Check',
    'Info': 'Info',
    'HelpCircle': 'Question',
    'Star': 'Star',
    'Heart': 'Heart',
    'ThumbsUp': 'ThumbsUp',
    'ThumbsDown': 'ThumbsDown',
    'Smile': 'Smiley',
    'User': 'User',
    'Users': 'Users',
    'UserPlus': 'UserPlus',
    'UserMinus': 'UserMinus',
    'Clock': 'Clock',
    'Calendar': 'Calendar',
    'Bell': 'Bell',
    'BellOff': 'BellSlash',
    'Home': 'House',
    'ShoppingCart': 'ShoppingCart',
    'ShoppingBag': 'Bag',
    'Tag': 'Tag',
    'Gift': 'Gift',
    'CreditCard': 'CreditCard',
    'DollarSign': 'CurrencyDollar',
    'Percent': 'Percent',
    'Briefcase': 'Briefcase',
    'Book': 'Book',
    'Bookmark': 'BookmarkSimple',
    'Award': 'Medal',
    'Target': 'Target',
    'Zap': 'Lightning',
    'Sun': 'Sun',
    'Moon': 'Moon',
    'CloudRain': 'CloudRain',
    'Wind': 'Wind',
    'Droplet': 'Drop',
    'Flame': 'Fire',
    'Map': 'Map',
    'Navigation': 'NavigationArrow',
    'Compass': 'Compass',
    'Layers': 'Stack',
    'Layout': 'SquaresFour',
    'LayoutDashboard': 'House',
    'Grid': 'GridFour',
    'List': 'List',
    'Maximize': 'CornersOut',
    'Minimize': 'CornersIn',
    'RefreshCw': 'ArrowsClockwise',
    'RotateCcw': 'ArrowCounterClockwise',
    'Shuffle': 'Shuffle',
    'Repeat': 'Repeat',
    'ArrowRight': 'ArrowRight',
    'ArrowLeft': 'ArrowLeft',
    'ArrowUp': 'ArrowUp',
    'ArrowDown': 'ArrowDown',
    'ArrowUpRight': 'ArrowUpRight',
    'ArrowDownRight': 'ArrowDownRight',
    'ArrowDownLeft': 'ArrowDownLeft',
    'ArrowUpLeft': 'ArrowUpLeft',
    'Circle': 'Circle',
    'Square': 'Square',
    'Triangle': 'Triangle',
    'Hexagon': 'Hexagon',
    'Package': 'Package',
    'Box': 'BoxArrowUp',
    'Feather': 'Feather',
    'PenTool': 'PenNib',
    'Scissors': 'Scissors',
    'Copy': 'Copy',
    'Clipboard': 'Clipboard',
    'Paperclip': 'Paperclip',
    'Printer': 'Printer',
    'Monitor': 'Monitor',
    'Tablet': 'DeviceTablet',
    'Battery': 'BatteryFull',
    'Bluetooth': 'Bluetooth',
    'Wifi': 'WifiHigh',
    'Radio': 'Radio',
    'Tv': 'Television',
    'Watch': 'Watch',
    'Headphones': 'Headphones',
    'Mic': 'Microphone',
    'CheckCircle2': 'CheckCircle',
    'CheckCircle': 'CheckCircle',
    'XCircle': 'XCircle',
    'PlusCircle': 'PlusCircle',
    'MinusCircle': 'MinusCircle',
    'ChevronRightCircle': 'ArrowCircleRight',
    'ChevronLeftCircle': 'ArrowCircleLeft',
    'ChevronUpCircle': 'ArrowCircleUp',
    'ChevronDownCircle': 'ArrowCircleDown',
    'ArrowRightCircle': 'ArrowCircleRight',
    'ArrowLeftCircle': 'ArrowCircleLeft',
    'ArrowUpCircle': 'ArrowCircleUp',
    'ArrowDownCircle': 'ArrowCircleDown',
    'Building2': 'Buildings',
    'Reply': 'ArrowUUpLeft',
    'CheckCheck': 'Checks',
    'Archive': 'Archive',
    'Lightbulb': 'Lightbulb',
    'Wallet': 'Wallet',
    'Apple': 'AppleLogo'
}

def resolve_icon(name):
    base = name.replace('Icon', '')
    if base in mapping:
        return mapping[base]
    return base

import sys

def process_file(path):
    with open(path, 'r') as f:
        content = f.read()

    pattern = re.compile(r'import\s+\{([^}]+)\}\s+from\s+[\'"]lucide-react[\'"];?')
    matches = pattern.finditer(content)
    
    modified = False
    
    # Process from the end so indices don't shift
    for match in reversed(list(matches)):
        raw_imports = match.group(1)
        icons = [i.strip() for i in raw_imports.split(',') if i.strip()]
        
        new_imports = []
        for icon in icons:
            if ' as ' in icon:
                orig, alias = icon.split(' as ')
                mapped = resolve_icon(orig.strip())
                new_imports.append(f"{mapped} as {alias.strip()}")
            else:
                mapped = resolve_icon(icon)
                new_imports.append(f"{mapped} as {icon}")
        
        new_import_stmt = 'import {\n  ' + ',\n  '.join(new_imports) + '\n} from "@phosphor-icons/react";'
        content = content[:match.start()] + new_import_stmt + content[match.end():]
        
        for icon in icons:
            tag_name = icon.split(' as ')[1].strip() if ' as ' in icon else icon
            # Add weight="fill" if not present
            content = re.sub(rf'<{tag_name}>', rf'<{tag_name} weight="fill">', content)
            # Find <TagName \s+... replacing with weight="fill"
            # It's safer to just inject it right after the tag name
            content = re.sub(rf'<{tag_name}\b(?![>])(?!.*?weight=[\'"])', rf'<{tag_name} weight="fill"', content)
        
        modified = True

    if modified:
        with open(path, 'w') as f:
            f.write(content)

count = 0
for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            try:
                process_file(path)
                count += 1
            except Exception as e:
                print(f"Error processing {path}: {e}")

print(f"Icons replaced in {count} files.")

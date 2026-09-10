import os
import re

fixes = {
    'SunMoon': 'Sun',
    'GalleryVerticalEnd': 'Cards',
    'Paintbrush': 'PaintBrush',
    'PanelLeft': 'SidebarSimple',
    'GripVertical': 'DotsSixVertical',
    'PhoneOff': 'PhoneSlash',
    'VideoOff': 'VideoCameraSlash',
    'Scale': 'Scales',
    'ArrowLeftRight': 'ArrowsLeftRight',
    'BadgeDollarSign': 'CurrencyDollar',
    'HeartPulse': 'Heartbeat',
    'LineChart': 'ChartLineUp',
    'MailOpen': 'EnvelopeOpen',
    'KeyRound': 'Key',
    'Undo2': 'ArrowUUpLeft',
    'MousePointer2': 'Cursor',
    'Underline': 'TextUnderline',
    'Type': 'TextT',
    'PlugZap': 'Plug',
    'FlaskConical': 'Flask',
    'ClipboardList': 'ClipboardText',
    'MoveVertical': 'ArrowsVertical',
    'BadgePercent': 'Percent',
    'TerminalSquare': 'TerminalWindow',
    'ShipWheel': 'SteeringWheel',
    'Bot': 'Robot',
    'Filter': 'Faders',
    'ShieldQuestion': 'Question',
    'ShieldOff': 'ShieldSlash',
    'ArrowUpDown': 'ArrowsDownUp',
    'MailCheck': 'EnvelopeSimple',
    'FileSpreadsheet': 'FileXls',
    'Tags': 'Tag'
}

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()
            
            mod = False
            for old, new in fixes.items():
                if old in content:
                    content = re.sub(rf'\b{old}\b', new, content)
                    mod = True
            
            if 'Storefront as Storefront' in content:
                content = content.replace('Storefront as Storefront', 'Storefront')
                mod = True
            if 'Power as Power' in content:
                content = content.replace('Power as Power', 'Power')
                mod = True
            if 'import { Storefront }' in content and 'type Storefront' in content:
                content = content.replace('type Storefront', 'type StorefrontData')
                mod = True
            if 'StoreManagementPage.tsx' in path:
                content = content.replace('Storefront |', 'any |')
                content = content.replace('extends Storefront', 'extends any')
            
            if mod:
                with open(path, 'w') as f:
                    f.write(content)


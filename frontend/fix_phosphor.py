import re
import glob

replacements = {
    'Home': 'House',
    'ShieldAlert': 'ShieldWarning',
    'UserX': 'UserMinus',
    'Building2': 'Buildings',
    'ScrollText': 'Scroll',
    'ArrowLeftRight': 'ArrowsLeftRight',
    'BadgeDollarSign': 'CurrencyDollar',
    'RotateCcw': 'ArrowCounterClockwise',
    'Activity': 'Activity',
    'HeartPulse': 'Heartbeat',
    'TrendingUp': 'TrendUp',
    'BarChart3': 'ChartBar',
    'LineChart': 'ChartLineUp',
    'Mail': 'Envelope',
    'MailOpen': 'EnvelopeOpen',
    'MessageSquareText': 'ChatText',
    'KeyRound': 'Key',
    'Link2': 'Link',
    'DollarSign': 'CurrencyDollar',
    'Award': 'Medal',
    'Store': 'Storefront',
    'Undo2': 'ArrowUUpLeft'
}

files = glob.glob('src/navigation/*.tsx') + ['src/components/site-header.tsx']
for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
        
    for old, new in replacements.items():
        content = re.sub(r'\b' + old + r'\b', new, content)
        
    with open(filepath, 'w') as f:
        f.write(content)

print("Fixed Phosphor icon names")

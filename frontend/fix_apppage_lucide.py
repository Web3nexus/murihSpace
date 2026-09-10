import re

with open('src/pages/AppPage.tsx', 'r') as f:
    content = f.read()

# I used <Users className="size-5" /> in my python script right rail replacement.
# I will replace it with Phosphor icons since my global script already ran on the IMPORTS.
# Actually, the imports in AppPage.tsx are ALREADY phosphor.
# But wait, my script added `TrendingUp` which might not be imported! 
# But wait, `TrendUp` is imported in AppPage.tsx because my global script changed it.
content = content.replace('<Users className="size-5" />', '<Users weight="fill" className="size-5" />')
content = content.replace('<TrendingUp className="size-5" />', '<TrendUp weight="fill" className="size-5" />')
content = content.replace('<Check className="size-3.5" />', '<Check weight="bold" className="size-3.5" />')

with open('src/pages/AppPage.tsx', 'w') as f:
    f.write(content)

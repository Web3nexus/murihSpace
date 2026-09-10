import re

with open('src/components/layout/ChatLayout.tsx', 'r') as f:
    content = f.read()

# Replace main container bg
content = content.replace('bg-background', 'bg-card')

# Remove padding from message bubbles (adjust radius)
content = content.replace('rounded-2xl', 'rounded-xl')

with open('src/components/layout/ChatLayout.tsx', 'w') as f:
    f.write(content)

print("Updated ChatLayout")

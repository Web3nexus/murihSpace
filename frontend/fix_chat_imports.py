import re

with open('src/components/layout/ChatLayout.tsx', 'r') as f:
    content = f.read()

# We just remove all "@phosphor-icons/react" imports and re-add them uniquely.
imports_blocks = re.findall(r'import\s+\{([^}]+)\}\s+from\s+[\'"]@phosphor-icons/react[\'"];?', content)

unique_icons = set()
for block in imports_blocks:
    icons = [i.strip() for i in block.split(',') if i.strip()]
    unique_icons.update(icons)

# Remove all phosphor import blocks
content = re.sub(r'import\s+\{([^}]+)\}\s+from\s+[\'"]@phosphor-icons/react[\'"];?\n?', '', content)

# Create the new block
new_import = 'import {\n  ' + ',\n  '.join(sorted(unique_icons)) + '\n} from "@phosphor-icons/react";\n'

# Insert it after the first import
lines = content.split('\n')
for i, line in enumerate(lines):
    if line.startswith('import '):
        lines.insert(i + 1, new_import)
        break

with open('src/components/layout/ChatLayout.tsx', 'w') as f:
    f.write('\n'.join(lines))


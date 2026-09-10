import os
import glob

# Walk through all tsx files
for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx'):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()

            # Global geometry changes
            content = content.replace('rounded-2xl', 'rounded-lg')
            content = content.replace('rounded-xl', 'rounded-lg')
            content = content.replace('shadow-xs', '')
            content = content.replace('shadow-sm', '')
            content = content.replace('shadow-md', 'shadow-sm')
            
            # Padding reductions (making it more compact like social media)
            content = content.replace('p-6', 'p-4')
            content = content.replace('p-8', 'p-5')
            content = content.replace('gap-6', 'gap-4')
            content = content.replace('gap-8', 'gap-5')
            
            # Headings reduction
            content = content.replace('text-2xl', 'text-xl')
            content = content.replace('text-3xl', 'text-xl')
            content = content.replace('text-4xl', 'text-2xl')

            # Border removals for generic cards (let backgrounds do the work)
            content = content.replace('border border-border', 'border-none')
            content = content.replace('border border-slate-100', 'border-none')
            
            with open(path, 'w') as f:
                f.write(content)

print("Geometry fixed globally.")

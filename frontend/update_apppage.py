import re

with open('src/pages/AppPage.tsx', 'r') as f:
    content = f.read()

# Fix composer
content = content.replace('bg-card border border-border shadow-xs rounded-2xl p-4 sm:p-5', 'bg-card sm:border border-border sm:rounded-xl p-4 sm:p-5')
# Fix post wrapper
content = content.replace('bg-card border border-border shadow-xs rounded-2xl p-4 sm:p-5 space-y-3', 'bg-card sm:border border-border sm:rounded-xl p-4 sm:p-5 space-y-3')
# Fix right rail sticky bg
content = content.replace('border-l border-border bg-[#F8F7F4] dark:bg-card/40', 'border-l border-border bg-transparent')
# Fix right rail cards
content = content.replace('rounded-2xl border border-border bg-card p-4 shadow-xs', 'border-b border-border bg-transparent py-4')
content = content.replace('rounded-2xl border border-border bg-card p-4.5 shadow-xs', 'border-b border-border bg-transparent py-4.5')
# Fix story card styling
content = content.replace('rounded-2xl border border-border bg-card', 'rounded-xl border border-border bg-card')

# Remove shadow-xs everywhere generally
content = content.replace('shadow-xs', '')

with open('src/pages/AppPage.tsx', 'w') as f:
    f.write(content)

print("Updated AppPage styles")

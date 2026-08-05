import re

with open('src/app/router/routes.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
imports_to_lazy = []
has_added_lazy_import = False

for line in lines:
    # Match default import: import FeedPage from "@/pages/FeedPage";
    default_match = re.match(r'import\s+([A-Za-z0-9_]+)\s+from\s+["\']([^"\']+)["\'];', line)
    # Match named import: import { LoginPage } from "@/pages/LoginPage";
    named_match = re.match(r'import\s+\{\s*([A-Za-z0-9_]+)\s*\}\s+from\s+["\']([^"\']+)["\'];', line)
    
    # We shouldn't lazy load RoutePaths, Layouts, or ProtectedRoute. Or maybe we can lazy load pages only.
    if ("@/pages/" in line or "@/components/" in line) and not "RoutePaths" in line and not "UIStateComponents" in line:
        if "Layout" in line or "ProtectedRoute" in line:
            new_lines.append(line)
            continue
            
        if default_match:
            name = default_match.group(1)
            path = default_match.group(2)
            imports_to_lazy.append(f'const {name} = lazy(() => import("{path}"));\n')
        elif named_match:
            name = named_match.group(1)
            path = named_match.group(2)
            imports_to_lazy.append(f'const {name} = lazy(() => import("{path}").then(module => ({{ default: module.{name} }})));\n')
        else:
            new_lines.append(line)
    else:
        if line.startswith('import ') and not has_added_lazy_import:
            new_lines.append('import { lazy, Suspense } from "react";\n')
            has_added_lazy_import = True
        new_lines.append(line)

# Find where to insert lazy declarations (after all imports)
insert_idx = 0
for i, line in enumerate(new_lines):
    if line.startswith('export const routes'):
        insert_idx = i
        break

new_lines.insert(insert_idx, '\n// Lazy-loaded pages\n')
for lazy_import in imports_to_lazy:
    new_lines.insert(insert_idx + 1, lazy_import)
    insert_idx += 1
new_lines.insert(insert_idx + 1, '\n')

with open('src/app/router/routes.tsx', 'w') as f:
    f.writelines(new_lines)

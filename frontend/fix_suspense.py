import re

with open('src/app/router/routes.tsx', 'r') as f:
    content = f.read()

# Add PageLoader import
import_page_loader = 'import { Loader2 } from "lucide-react";\n\nconst PageLoader = () => (<div className="flex h-[50vh] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/50" /></div>);\n'

content = content.replace('// Lazy-loaded pages', import_page_loader + '\n// Lazy-loaded pages')

# Find element: <Something /> and wrap it in Suspense, EXCEPT for ProtectedRoute, DashboardLayout, SettingsLayout, ChatLayout
# Wait, ProtectedRoute already wraps the children. Let's just create a custom Suspense wrapper function.
# Actually, the easiest way is to define a helper function at the top of routes.tsx:
# const L = (Component: React.FC) => <Suspense fallback={<PageLoader />}><Component /></Suspense>;

# Then replace element: <PageName /> with element: <Suspense fallback={<PageLoader />}><PageName /></Suspense>

def wrap_with_suspense(match):
    full_match = match.group(0)
    element = match.group(1)
    
    # Don't wrap Layouts or Navigate
    if "Layout" in element or "Navigate" in element or "NotFoundState" in element:
        return full_match
        
    # If it's a ProtectedRoute, we need to wrap the children of ProtectedRoute
    if "ProtectedRoute" in element:
        # e.g. <ProtectedRoute><ContentStudioPage /></ProtectedRoute>
        inner_match = re.search(r'<ProtectedRoute[^>]*>(.*?)</ProtectedRoute>', element)
        if inner_match:
            inner_comp = inner_match.group(1)
            # wrap inner_comp
            new_inner = f'<Suspense fallback={{<PageLoader />}}>{inner_comp}</Suspense>'
            new_element = element.replace(inner_comp, new_inner)
            return f'element: {new_element}'
        return full_match
        
    return f'element: <Suspense fallback={{<PageLoader />}}>{element}</Suspense>'

# The regex looks for element: <ComponentProps /> 
new_content = re.sub(r'element:\s*(<[^>]+>(?:.*?</[^>]+>)?|<[^/>]+/>)', wrap_with_suspense, content)

with open('src/app/router/routes.tsx', 'w') as f:
    f.write(new_content)


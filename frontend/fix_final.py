import os
import re

fixes = {
    'ImageOff': 'ImageSquare',
    'FileSearch': 'FileMagnifyingGlass',
    'PinOff': 'PushPinSlash',
    'Pin': 'PushPin',
    'HandMetal': 'HandGrabbing'
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
            
            # fix Power duplicate
            if 'Power, Power' in content:
                content = content.replace('Power, Power', 'Power')
                mod = True
            if 'Power as Power' in content:
                content = content.replace('Power as Power', 'Power')
                mod = True
                
            # fix recharts ChartLineUp
            if 'recharts' in content and 'ChartLineUp' in content:
                content = content.replace('ChartLineUp', 'LineChart')
                mod = True
                
            # dedupe Storefront
            if 'StoreManagementPage.tsx' in path:
                if 'Storefront,' in content and 'Storefront as' not in content:
                    content = re.sub(r'Storefront,\s*Storefront', 'Storefront', content)
                    mod = True
                if 'import { Storefront } from "@/types/store"' in content:
                    content = content.replace('import { Storefront } from "@/types/store"', 'import { Storefront as StorefrontData } from "@/types/store"')
                    content = content.replace('extends Storefront', 'extends StorefrontData')
                    content = content.replace('Storefront |', 'StorefrontData |')
                    mod = True
                
            if mod:
                with open(path, 'w') as f:
                    f.write(content)


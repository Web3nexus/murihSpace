const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // 1. Remove API_BASE definition
  const apiBaseRegex = /const API_BASE\s*=\s*.*?;/g;
  if (apiBaseRegex.test(content)) {
    content = content.replace(apiBaseRegex, '');
    changed = true;
  }

  // 2. Remove getAuthHeaders definition
  const getAuthHeadersRegex = /function getAuthHeaders\(\)(?:\s*:\s*Record<string,\s*string>)?\s*\{[\s\S]*?return\s*\{[\s\S]*?\};\s*\}/g;
  if (getAuthHeadersRegex.test(content)) {
    content = content.replace(getAuthHeadersRegex, '');
    changed = true;
  }
  
  // 3. Remove import { getAuthToken } if it exists and replace with import { authFetch }
  // Only if authFetch is not already imported
  if (!content.includes('import { authFetch }')) {
    if (content.includes('getAuthToken') && changed) {
       content = content.replace(/import\s+\{\s*getAuthToken\s*\}\s+from\s+['"]@\/lib\/auth\/token['"];?/, 'import { authFetch } from "@/lib/api/authFetch";');
    }
  }

  // 4. Replace ${API_BASE} with empty string
  if (content.includes('${API_BASE}')) {
    content = content.replace(/\$\{API_BASE\}/g, '');
    changed = true;
  }

  // 5. Replace fetch( with authFetch( (this is a bit aggressive but authFetch works as a drop-in)
  // Only if it's a fetch that we want to replace. We can just replace fetch( with authFetch( globally
  // except for things like window.fetch. Let's do a basic global replace of ' fetch(' or 'await fetch('
  if (changed) {
    content = content.replace(/await fetch\(/g, 'await authFetch(');
    content = content.replace(/return fetch\(/g, 'return authFetch(');
    content = content.replace(/\sfetch\(/g, ' authFetch(');
    
    // Also remove `headers: getAuthHeaders(),` or `headers: getAuthHeaders()`
    content = content.replace(/headers:\s*getAuthHeaders\(\),?/g, '');
    
    // Remove empty headers objects that might be left over: `{  }` or `{ method: 'GET',  }`
    // It's safer to leave them or let prettier/linter fix them.
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walk(pagesDir);
console.log("Done.");

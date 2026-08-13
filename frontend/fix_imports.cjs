const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // 1. If authFetch is used but not imported
  if (content.includes('authFetch(') && !content.includes('import { authFetch }')) {
    // Add import at the top
    content = 'import { authFetch } from "@/lib/api/authFetch";\n' + content;
    changed = true;
  }

  // 2. If getAuthToken is used but not imported
  // (Note: getAuthToken might be part of another string, but usually it's getAuthToken())
  if (content.includes('getAuthToken(') && !content.includes('import { getAuthToken }')) {
    content = 'import { getAuthToken } from "@/lib/auth/token";\n' + content;
    changed = true;
  }
  
  // 3. If authFetch is imported but not used
  if (content.includes('import { authFetch }') && !content.includes('authFetch(')) {
    content = content.replace(/import\s+\{\s*authFetch\s*\}\s+from\s+['"]@\/lib\/api\/authFetch['"];?\n?/g, '');
    changed = true;
  }
  
  // Also, remove env if unused in EscrowPage
  if (filePath.endsWith('EscrowPage.tsx') && content.includes('import { env }') && !content.includes('env.')) {
     content = content.replace(/import\s+\{\s*env\s*\}\s+from\s+['"]@\/config\/env['"];?\n?/g, '');
     changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed ${filePath}`);
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
console.log("Fix done.");

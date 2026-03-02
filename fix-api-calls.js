const fs = require('fs');
const path = require('path');

const storeDir = path.join(__dirname, 'src', 'store');
const files = fs.readdirSync(storeDir).filter(f => f.endsWith('.ts'));

let totalReplaced = 0;
for (const file of files) {
    const fp = path.join(storeDir, file);
    let content = fs.readFileSync(fp, 'utf8');
    const before = content;
    // Replace: fetch(`${API_URL}/  →  apiFetch(`/
    content = content.replace(/fetch\(`\$\{API_URL\}\//g, "apiFetch(`/");
    // Replace: fetch(`${API_URL}?  →  apiFetch(`/?  (edge case with query strings directly)
    content = content.replace(/fetch\(`\$\{API_URL\}`/g, "apiFetch(`/api`");
    if (content !== before) {
        fs.writeFileSync(fp, content, 'utf8');
        const count = (before.match(/fetch\(`\$\{API_URL\}/g) || []).length;
        console.log(`✅ ${file}: replaced ${count} occurrences`);
        totalReplaced += count;
    }
}
console.log(`\nTotal: ${totalReplaced} replacements across ${files.length} store files.`);

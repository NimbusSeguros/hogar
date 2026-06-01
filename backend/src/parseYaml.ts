import fs from 'fs';
const content = fs.readFileSync('c:\\Users\\nimbu\\Downloads\\siapi.yml', 'utf8');

const pathRegex = /^  (\/v1\/[a-zA-Z0-9_\-\/{}\/]+):/gm;
let match;
while ((match = pathRegex.exec(content))) {
    const path = match[1];
    const startIndex = match.index;
    const nextPathIndex = content.indexOf('\n  /', startIndex + 5);
    const block = content.substring(startIndex, nextPathIndex !== -1 ? nextPathIndex : undefined);

    if (block.toLowerCase().includes('3 pasos') || block.toLowerCase().includes('interactivo')) {
        console.log("MATCH:", path);
    }
}

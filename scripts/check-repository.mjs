/* Check the small distributable without requiring external packages. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = [];
function walk(directory) {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
        if (['.git', 'node_modules'].includes(entry.name)) continue;
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(target);
        else files.push(target);
    }
}
walk(root);
const required = ['README.md', 'LICENSE', 'AGENTS.md', 'llms.txt', 'plugin/glb_rig_importer.js', 'docs/assets/hero.svg'];
for (const name of required) {
    if (!fs.existsSync(path.join(root, name))) throw new Error('Missing required file: ' + name);
}
for (const file of files) {
    if (!/\.(md|txt|js|mjs|json|yml|svg)$/.test(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (/\p{Script=Cyrillic}/u.test(text)) throw new Error('Non-English repository text: ' + path.relative(root, file));
    if (file.endsWith('.md')) {
        for (const match of text.matchAll(/(?:!?\[[^\]]*\]\(|(?:src|href)=")([^\s)"#]+)(?:#[^\s)"]*)?/g)) {
            const link = match[1];
            if (/^(https?:|mailto:)/.test(link)) continue;
            const target = path.resolve(path.dirname(file), decodeURIComponent(link));
            if (!target.startsWith(root) || !fs.existsSync(target)) {
                throw new Error('Broken local link in ' + path.relative(root, file) + ': ' + link);
            }
        }
    }
}
const hero = fs.readFileSync(path.join(root, 'docs/assets/hero.svg'), 'utf8');
if (!hero.includes('xmlns="http://www.w3.org/2000/svg"') || !hero.includes('<title') || !hero.includes('</svg>')) throw new Error('Invalid hero SVG structure.');
console.log('Repository checks passed: required assets, English text and local documentation links.');

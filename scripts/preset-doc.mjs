// Writes the generated reference (names and value ranges) into docs/preset-guide.md,
// between the BEGIN/END REFERENZ markers. Run after changing preset.js or effect-params.js:
//   npm run docs:preset
import { readFileSync, writeFileSync } from 'node:fs';
import { presetReference } from '../src/lib/preset.js';

const file = new URL('../docs/preset-guide.md', import.meta.url);
const text = readFileSync(file, 'utf8');
const marker = /(<!-- BEGIN REFERENZ[^>]*-->)[\s\S]*?(<!-- END REFERENZ -->)/;
if (!marker.test(text)) throw new Error('Markierungen in docs/preset-guide.md fehlen');
writeFileSync(file, text.replace(marker, (_, begin, end) => `${begin}\n${presetReference()}\n${end}`));
console.log('docs/preset-guide.md: Referenz aktualisiert');

// Builds the listening bench: tools/music-bench.template.html with the real audio.js spliced in.
//   node tools/music-bench.mjs [out]   (default artifacts/music-bench.html)
// Nothing else can hear the score. Publish or open the output after every change to audio.js.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'artifacts', 'music-bench.html'));
const template = fs.readFileSync(path.join(root, 'tools', 'music-bench.template.html'), 'utf8');
const audio = fs.readFileSync(path.join(root, 'audio.js'), 'utf8');
if (!template.includes('/*__AUDIO_JS__*/')) throw new Error('template is missing the /*__AUDIO_JS__*/ marker');
fs.writeFileSync(out, template.replace('/*__AUDIO_JS__*/', () => audio));
console.log('wrote ' + path.relative(root, out));

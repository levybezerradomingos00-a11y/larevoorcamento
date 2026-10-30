import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
await mkdir(new URL('vendor/', root), { recursive: true });
for (const [source, destination] of [
  ['node_modules/html2canvas/dist/html2canvas.min.js', 'html2canvas.min.js'],
  ['node_modules/html2canvas/LICENSE', 'html2canvas.LICENSE.txt'],
  ['node_modules/jspdf/dist/jspdf.umd.min.js', 'jspdf.umd.min.js'],
  ['node_modules/jspdf/LICENSE', 'jspdf.LICENSE.txt']
]) await copyFile(new URL(source, root), new URL(`vendor/${destination}`, root));
console.log(`Bibliotecas locais preparadas em ${fileURLToPath(new URL('vendor/', root))}`);
await import('./styles.mjs');

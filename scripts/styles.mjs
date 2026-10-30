import { readFile, writeFile } from 'node:fs/promises';
import postcss from 'postcss';

// Prepare PDF styles at development time; browsers never need CSSOM access.
const root = new URL('../', import.meta.url);
const screen = await readFile(new URL('styles.css', root), 'utf8');
const print = [];
postcss.parse(screen).walkAtRules('media', rule => {
  if (rule.params.trim() === 'print') print.push(...rule.nodes.map(node => node.toString()));
});
if (!print.length) throw new Error('Nenhuma regra de impressão encontrada em styles.css.');
const data = JSON.stringify({ screen, print: print.join('\n') });
await writeFile(new URL('styles.js', root), `// Generated from styles.css by scripts/styles.mjs.\nwindow.LarevoStyles = Object.freeze(${data});\n`);
console.log('Estilos de exportação preparados em styles.js');

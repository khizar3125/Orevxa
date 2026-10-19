import { cp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const item of ['index.html', 'play.html', 'modeler.html', 'src', 'public']) {
  const source = path.join(root, item);
  try { await stat(source); await cp(source, path.join(out, item === 'public' ? '.' : item), { recursive: true }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
await writeFile(path.join(out, 'README-DEPLOY.txt'), `Orvexa Studio production build\n\nThis output is a static site. Deploy the contents of this dist directory to Netlify or another static host.\nNo server-side API keys or backend are required.\n`);
console.log(`Built static Orvexa Studio into ${path.relative(root, out)}/`);
console.log('The language engine runs in the browser; no bundler or external runtime dependency is required.');

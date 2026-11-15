import { writeFile } from 'node:fs/promises';

const owner = 'BeubeuReturns';
const repo = 'cobblemon_sprites';
const api = `https://api.github.com/repos/${owner}/${repo}`;
const headers = { accept: 'application/vnd.github+json', 'user-agent': 'pokepaper-sprite-index-sync' };

const [treeResponse, commitsResponse] = await Promise.all([
  fetch(`${api}/git/trees/main?recursive=1`, { headers }),
  fetch(`${api}/commits?per_page=1`, { headers }),
]);
if (!treeResponse.ok || !commitsResponse.ok) throw new Error('Could not read the upstream Cobblemon sprite archive.');
const [treeData, commits] = await Promise.all([treeResponse.json(), commitsResponse.json()]);
const latest = commits[0];
const paths = treeData.tree
  .filter(file => file.type === 'blob' && file.path.startsWith('models/') && file.path.endsWith('.png'))
  .map(file => file.path);
const grouped = new Map();
const extras = [];
for (const path of paths) {
  let stem = path.slice('models/'.length, -'.png'.length);
  const shiny = stem.endsWith('-shiny');
  if (shiny) stem = stem.slice(0, -'-shiny'.length);
  const match = stem.match(/^(\\d+)(?:-(.*))?$/);
  if (!match) {
    extras.push({ id: null, form: 'standard', name: stem, normal: path, shiny: null });
    continue;
  }
  const id = Number(match[1]);
  const form = match[2] || 'standard';
  const key = id + '|' + form;
  if (!grouped.has(key)) grouped.set(key, { id, form, normal: null, shiny: null });
  grouped.get(key)[shiny ? 'shiny' : 'normal'] = path;
}
const records = [...grouped.values(), ...extras]
  .sort((a, b) => (a.id ?? 99999) - (b.id ?? 99999) || a.form.localeCompare(b.form));
const output = {
  sourceRepository: `https://github.com/${owner}/${repo}`,
  sourceCommit: latest.sha,
  sourceUpdatedAt: latest.commit.author.date,
  assetBase: `https://raw.githubusercontent.com/${owner}/${repo}/${latest.sha}/`,
  spriteFileCount: paths.length,
  entryCount: records.length,
  records,
};
await writeFile(new URL('../cobblemon-sprites.json', import.meta.url), JSON.stringify(output, null, 2) + '\\n');
console.log(`Indexed ${paths.length} sprites across ${records.length} Pokémon/form entries from ${latest.sha.slice(0, 7)}.`);

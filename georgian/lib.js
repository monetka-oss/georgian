const strip = s => s.replace(/\*+/g, '').trim();

function parse(md) {
  const lines = md.split('\n');
  const title = (lines.find(l => l.startsWith('# ')) || '').slice(2).trim();
  const levels = [];
  let cur;
  for (const l of lines) {
    if (!l.startsWith('|') || /^\|\s*:?-/.test(l) || l.startsWith('| Категория')) continue;
    const [cat, ka, , ru, ctx = ''] = l.trim().slice(1, -1).split('|').map(strip);
    if (cat || !cur) levels.push(cur = { name: cat, items: [] });
    cur.items.push({ ka, ru, ctx });
  }
  return { title, levels };
}

const norm = s => s.replace(/\([^)]*\)/g, '').toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const check = (ka, input) => ka.split('/').map(norm).filter(Boolean).includes(norm(input));
const typable = it => !/\[|\s\.\.\.\s/.test(it.ka);

const shuffle = a => {
  a = [...a];
  for (let i = a.length; i > 1;) { const j = Math.random() * i-- | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const options = (it, pool) => shuffle([it, ...shuffle(pool.filter(p => p.ka !== it.ka)).slice(0, 3)]);

if (typeof module !== 'undefined') module.exports = { parse, norm, check, typable, shuffle, options };

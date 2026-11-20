const clean = s => s.replace(/<br\s*\/?>/g, ' ').replace(/\*+/g, '').trim();
const cells = l => l.trim().slice(1, -1).split('|').map(s => s.trim());

function parse(md) {
  const lines = md.split('\n'), levels = [];
  const title = clean((lines.find(l => l.startsWith('# ')) || '').slice(2)).replace(/^[^\p{L}\p{N}]+/u, '');
  let head = '', cur = null, hdr = null;
  const add = (name, it) => {
    if (!cur || cur.name !== name) levels.push(cur = { name, items: [] });
    cur.items.push(it);
  };
  for (const l of lines) {
    if (!l.startsWith('|')) { hdr = null; if (l.startsWith('## ')) head = clean(l.slice(3)).replace(/^\d+\.\s*/, ''); continue; }
    if (!hdr) { hdr = cells(l).map(clean); continue; }
    if (/^\|\s*:?-/.test(l)) continue;
    const c = cells(l), t = hdr.findIndex(h => /Транскрипц/.test(h));
    if (t < 0) { // спряжение: значение | я | ты | он | пример
      const ctx = clean(c[c.length - 1]);
      for (let p = 1; p < c.length - 1; p++)
        add(head, { ka: clean(c[p].split('<br>')[0]).replace(/\s*\([^)]*\)/g, ''),
          ru: `${clean(c[0])} — ${hdr[p].replace(/\s*\(.*$/, '').toLowerCase()}`, ctx });
    } else add(hdr[0] === 'Категория' ? clean(c[0]) || cur.name : head,
      { ka: clean(c[t - 1]), ru: clean(c[t + 1]), ctx: clean(c[t + 2] || '') });
  }
  return { title, levels };
}

const norm = s => s.replace(/\([^)]*\)/g, '').toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const check = (ka, input) => [ka, ...ka.split('/')].map(norm).filter(Boolean).includes(norm(input));
const typable = it => !/\[|\s\.\.\.\s/.test(it.ka);

const shuffle = a => {
  a = [...a];
  for (let i = a.length; i > 1;) { const j = Math.random() * i-- | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const options = (it, pool) => shuffle([it, ...shuffle(pool.filter(p => p.ka !== it.ka)).slice(0, 3)]);

if (typeof module !== 'undefined') module.exports = { parse, norm, check, typable, shuffle, options };

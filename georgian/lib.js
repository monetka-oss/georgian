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
    if (t < 0) {
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

const splitWords = s => s.split(/\s+/).filter(Boolean);
const phrase = it => it.ka.split('/')[0].replace(/\([^)]*\)/g, '').trim();
const buildable = it => typable(it) && splitWords(phrase(it)).length > 1;

// Дистракторы: без шаблонов ([Имя], «...»), похожей длины, предпочтительно из того же уровня (near)
const options = (it, pool, near = []) => {
  const L = it.ka.length, seen = new Set([it.ka]), wrong = [];
  const ranked = pool.filter(p => p !== it && typable(p))
    .map(p => [Math.abs(p.ka.length - L) + (near.includes(p) ? 0 : 8) + Math.random() * 3, p]).sort((a, b) => a[0] - b[0]);
  for (const [, p] of ranked) if (wrong.length < 3 && !seen.has(p.ka)) { seen.add(p.ka); wrong.push(p); }
  return shuffle([it, ...wrong]);
};

// ---------- SRS: оценка 1 = «Повторить», 3 = «Знаю». Ключ — сама фраза, а не номер строки ----------
const sKey = it => 'georgian_srs_v2:' + it.ka + '|' + it.ru;
const srsGet = it => { try { return JSON.parse(localStorage.getItem(sKey(it))); } catch { return null; } };
const srsSet = (it, s) => { try { localStorage.setItem(sKey(it), JSON.stringify(s)); } catch {} };
const srsDefault = () => ({ interval: 0, ease: 2.5, reps: 0, due: 0, status: 'new' });
function srsUpdate(s, grade) {
  if (grade === 1) return { interval: 0, ease: Math.max(1.3, s.ease - 0.2), reps: 0, due: Date.now(), status: 'learning' };
  const reps = s.reps + 1, interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(s.interval * s.ease);
  return { interval, ease: s.ease + 0.1, reps, due: Date.now() + interval * 864e5, status: 'review' };
}
const srsIsDue = s => !s || s.status !== 'review' || Date.now() >= s.due;   // для карточек уровня: всё, что ещё не выучено
const srsAll = chapters => chapters.flatMap((c, ci) => c.levels.flatMap((l, li) =>
  l.items.map((item, ii) => ({ ci, li, ii, item, srs: srsGet(item) || srsDefault() }))));
const srsDue = chapters => srsAll(chapters).filter(x => x.srs.status === 'learning' || (x.srs.status === 'review' && srsIsDue(x.srs)));
const levelDone = items => items.every(it => srsGet(it)?.status === 'review');

if (typeof module !== 'undefined') module.exports = { parse, norm, check, typable, shuffle, splitWords, phrase, buildable, options,
  srsGet, srsSet, srsDefault, srsUpdate, srsIsDue, srsAll, srsDue, levelDone };

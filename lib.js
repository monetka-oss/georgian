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

// Дистракторы по длине (похожие варианты, без очевидного мусора)
const options = (it, pool) => {
  const targetLen = it.ka.length;
  const similar = pool
    .filter(p => p.ka !== it.ka)
    .sort((a, b) => Math.abs(a.ka.length - targetLen) - Math.abs(b.ka.length - targetLen))
    .slice(0, 3);
  return shuffle([it, ...similar]);
};

const splitWords = ka => ka.split(/\s+/).filter(Boolean);

// ---------- SRS (интервальные повторения, Anki-стиль) ----------
const STORAGE_KEY = 'georgian_srs_v1';
function srsKey(ci, li, ii) { return `${STORAGE_KEY}:${ci}:${li}:${ii}`; }
function srsGet(ci, li, ii) {
  try { const raw = localStorage.getItem(srsKey(ci, li, ii)); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function srsSet(ci, li, ii, state) { try { localStorage.setItem(srsKey(ci, li, ii), JSON.stringify(state)); } catch {} }
function srsDefault() { return { interval: 1, ease: 2.5, reps: 0, due: Date.now(), status: 'new' }; }
function srsUpdate(state, grade) {
  const now = Date.now();
  let { interval, ease, reps } = state;
  if (grade === 1) { // Повторить
    interval = 1; reps = 0; ease = Math.max(1.3, ease - 0.2);
  } else { // Знаю
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 3;
    else interval = Math.round(interval * ease);
    if (grade === 3) ease += 0.1;
  }
  return { interval, ease, reps, due: now + interval * 86400000, status: grade === 1 ? 'learning' : 'review' };
}
function srsIsDue(state) { return state ? Date.now() >= state.due : true; }
function srsAll(chapters) {
  const out = [];
  chapters.forEach((c, ci) => c.levels.forEach((l, li) => l.items.forEach((it, ii) => {
    const s = srsGet(ci, li, ii) || srsDefault();
    out.push({ ci, li, ii, item: it, srs: s });
  })));
  return out;
}
function srsDue(chapters) { return srsAll(chapters).filter(x => srsIsDue(x.srs)); }

// Завершённые уровни (для галочек на плитках)
const COMPLETED_KEY = 'georgian_completed_v1';
function isCompleted(ci, li) {
  try { return JSON.parse(localStorage.getItem(COMPLETED_KEY) || '{}')[[ci, li].join(':')] === true; } catch { return false; }
}
function setCompleted(ci, li, val) {
  try {
    const obj = JSON.parse(localStorage.getItem(COMPLETED_KEY) || '{}');
    obj[[ci, li].join(':')] = val;
    localStorage.setItem(COMPLETED_KEY, JSON.stringify(obj));
  } catch {}
}

Object.assign(window, { parse, norm, check, typable, shuffle, options, splitWords,
  srsGet, srsSet, srsDefault, srsUpdate, srsIsDue, srsAll, srsDue, isCompleted, setCompleted });

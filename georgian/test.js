const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const store = {};
global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
const L = require('./lib.js');
const { parse, check, typable, options, phrase, buildable, srsGet, srsSet, srsDefault, srsUpdate, srsIsDue, srsDue, levelDone } = L;
const load = f => parse(fs.readFileSync(`data/${f}.md`, 'utf8'));

test('parse: уровни и количество строк', () => {
  const [a, b] = [load('part1'), load('part2')];
  assert.deepStrictEqual([a.levels.length, b.levels.length], [9, 6]);
  assert.strictEqual(a.levels.flatMap(l => l.items).length, 53);
  assert.strictEqual(b.levels.flatMap(l => l.items).length, 50);
  assert.strictEqual(a.levels[0].name, 'Быт и поиск');
  assert.strictEqual(a.levels[0].items.length, 3); // пустая категория = продолжение
});

test('parse: разметка вычищена, поля не пустые', () => {
  for (const f of ['part1', 'part2', 'part3'])
    for (const it of load(f).levels.flatMap(l => l.items)) {
      assert.ok(it.ka && it.ru, `пустое поле: ${JSON.stringify(it)}`);
      assert.ok(!/\*|<br/.test(it.ka + it.ru + it.ctx), `осталась разметка: ${it.ka}`);
    }
});

test('данные: в грузинском столбце нет кириллицы (кроме [Имя] и пояснений «(… — …)»)', () => {
  for (const f of ['part1', 'part2', 'part3'])
    for (const it of load(f).levels.flatMap(l => l.items))
      assert.ok(!/[а-яё]/i.test(it.ka.replace(/\[[^\]]*\]|\([^)]*—[^)]*\)/g, '')), `кириллица в: ${it.ka}`);
});

test('check: варианты, пунктуация, скобки, регистр', () => {
  assert.ok(check('გაუმარჯოს! / გაგიმარჯოს!', 'გაგიმარჯოს'));
  assert.ok(check('ვაიმე! / ვაიმე დედა!', ' ვაიმე   დედა '));
  assert.ok(check('რომ (в речи — რო)', 'რომ'));
  assert.ok(check('მოიცა, ერთი წამი...', 'მოიცა ერთი წამი'));
  assert.ok(!check('პური მინდა', 'ყავა მინდა'));
  assert.ok(!check('არ / ვერ', ''));
});

test('typable: шаблоны не попадают в ввод', () => {
  assert.ok(!typable({ ka: 'მე [Имя] მქვია, შენ?' }));
  assert.ok(!typable({ ka: 'რომ ... -დი / -და' }));
  assert.ok(typable({ ka: 'მოიცა, ერთი წამი...' }));
});

test('options: 4 уникальных варианта, верный среди них', () => {
  const pool = load('part2').levels.flatMap(l => l.items);
  for (const it of pool.slice(0, 20)) {
    const o = options(it, pool);
    assert.strictEqual(o.length, 4);
    assert.strictEqual(new Set(o.map(x => x.ka)).size, 4);
    assert.ok(o.some(x => x.ka === it.ka));
  }
});

test('parse: part3 (уровни = заголовки ##, глаголы по лицам)', () => {
  const c = load('part3'), n = i => c.levels[i].items.length;
  assert.ok(/^Уличный/.test(c.title), 'эмодзи в заголовке');
  assert.deepStrictEqual(c.levels.map((_, i) => n(i)), [11, 51, 8, 11, 7, 4]);
  assert.strictEqual(c.levels[0].name, 'Уважение, похвала и респект ровному типу');
  const v = c.levels[1].items;
  assert.deepStrictEqual(v[0], { ka: 'მესმის / მივხვდი', ru: 'Понимать / Догнать — я',
    ctx: 'აზრზე ხარ, რას ვამბობ? (Сечешь, о чём я?)' });
  assert.ok(v.some(x => x.ru === 'Лежать (вещи) — я' && x.ka === 'მიდევს'));
  assert.ok(v.some(x => x.ru === 'Покупать — он / она' && x.ka === 'ყიდულობს'));
});

test('check: можно вписать вариант целиком, вместе со «/»', () => {
  assert.ok(check('უფრო მუქი / უფრო ღია აქვთ?', 'უფრო მუქი / უფრო ღია აქვთ'));
  assert.ok(check('უფრო მუქი / უფრო ღია აქვთ?', 'უფრო მუქი'));
});

test('options: шаблоны ([Имя], «...») не бывают дистракторами, варианты близки по длине', () => {
  const lvls = load('part1').levels, pool = lvls.flatMap(l => l.items);
  let d = 0, n = 0, base = 0;
  for (const l of lvls) for (const it of l.items) for (let r = 0; r < 5; r++) {
    const wrong = options(it, pool, l.items).filter(x => x !== it);
    assert.ok(wrong.every(typable), `мусорный вариант для «${it.ru}»`);
    wrong.forEach(w => { d += Math.abs(w.ka.length - it.ka.length); n++; });
    base += pool.reduce((a, p) => a + Math.abs(p.ka.length - it.ka.length), 0) / pool.length * 3;
  }
  assert.ok(d / n < base / n / 3 * 0.6, 'дистракторы должны быть заметно ближе по длине, чем случайные');
});

test('phrase/buildable: первый вариант, без скобок; одно слово и шаблоны не собираются', () => {
  assert.strictEqual(phrase({ ka: 'ვაიმე! / ვაიმე დედა!' }), 'ვაიმე!');
  assert.strictEqual(phrase({ ka: 'რომ (в речи — რო)' }), 'რომ');
  assert.ok(buildable({ ka: 'ბოლო ფასი რა არის?' }));
  assert.ok(!buildable({ ka: 'ანუ' }));
  assert.ok(!buildable({ ka: 'მე [Имя] მქვია, შენ?' }));
});

test('SRS: «Повторить» остаётся в повторении, «Знаю» растит интервал 1 → 3 → ×ease', () => {
  const it = { ka: 'ტესტი', ru: 'тест' };
  assert.ok(srsIsDue(srsGet(it)), 'новая фраза показывается в карточках');
  let s = srsUpdate(srsDefault(), 1);
  assert.strictEqual(s.status, 'learning'); assert.ok(srsIsDue(s));
  s = srsUpdate(s, 3); assert.deepStrictEqual([s.status, s.interval], ['review', 1]); assert.ok(!srsIsDue(s));
  s = srsUpdate(s, 3); assert.strictEqual(s.interval, 3);
  s = srsUpdate(s, 3); assert.ok(s.interval >= 7);
  assert.strictEqual(srsUpdate(s, 1).reps, 0);
});

test('srsDue: только «сложные» и просроченные, новые фразы не попадают', () => {
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(x => ({ ka: x, ru: x }));
  srsSet(a, srsUpdate(srsDefault(), 1));                                  // сложная
  srsSet(b, srsUpdate(srsDefault(), 3));                                  // знаю, срок не пришёл
  srsSet(c, { ...srsUpdate(srsDefault(), 3), due: Date.now() - 1 });      // знаю, срок пришёл
  const ch = [{ levels: [{ items: [a, b, c, d] }] }];
  assert.deepStrictEqual(srsDue(ch).map(x => x.item.ka).sort(), ['a', 'c']);
  assert.ok(!levelDone([a, b, c, d]));
  srsSet(a, srsUpdate(srsGet(a), 3)); srsSet(d, srsUpdate(srsDefault(), 3));
  assert.ok(levelDone([a, b, c, d]));
});

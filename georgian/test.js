const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { parse, check, typable, options } = require('./lib.js');
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
  for (const f of ['part1', 'part2'])
    for (const it of load(f).levels.flatMap(l => l.items)) {
      assert.ok(it.ka && it.ru, `пустое поле: ${JSON.stringify(it)}`);
      assert.ok(!/\*/.test(it.ka + it.ru + it.ctx), `осталась разметка: ${it.ka}`);
    }
});

test('данные: в грузинском столбце нет кириллицы (кроме [Имя] и пояснений «(… — …)»)', () => {
  for (const f of ['part1', 'part2'])
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

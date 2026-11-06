import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { PALETTES, paletteVars } from '../src/core/palettes.js';
import { migrateSettings } from '../src/core/settings.js';
import { DARK_CLASS, startPalette } from '../src/ui/palette.js';

const CSS = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

test('палитры: пять штук, каждая задаёт все токены, которыми пользуется style.css', () => {
  assert.deepEqual(PALETTES.map(p => p.id), ['pink', 'graphite', 'noir', 'latte', 'matcha']);
  assert.deepEqual(paletteVars('pink'), {}, 'розовая уже в style.css');
  const used = new Set([...CSS.matchAll(/var\((--pud-[\w-]+)/g)].map(match => match[1]));
  for (const local of ['--pud-toast', '--pud-depth', '--pud-f-mono']) used.delete(local);
  const defined = new Set([...CSS.matchAll(/^\s*(--pud-[\w-]+):/gm)].map(match => match[1]));
  for (const name of used) assert.ok(defined.has(name), `токен ${name} используется, но не задан в style.css`);
  // цветовые токены: значение — цвет, тройка чисел или картинка
  const colorTokens = [...CSS.matchAll(/^\s*(--pud-[\w-]+):\s*(#|rgba?\(|\d+ \d+ \d+;|url\()/gm)].map(match => match[1]);
  for (const p of PALETTES.slice(1)) {
    const vars = paletteVars(p.id);
    for (const name of colorTokens) assert.ok(name in vars, `${p.id}: нет ${name}`);
    assert.match(vars['--pud-card-rgb'], /^\d+ \d+ \d+$/);
    assert.match(vars['--pud-paw'], /^url\("data:image\/svg\+xml,/);
  }
});

test('в стилях не осталось литеральных цветов вне определения токенов', () => {
  const body = CSS.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .filter(line => !/^\s*--pud-[\w-]+:\s*(#[0-9a-fA-F]+|rgba?\([^)]*\)|[\d ]+)\s*;\s*$/.test(line) && !line.includes('url("data:'));
  const left = body.filter(line => /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/.test(line) && !/#000\b/.test(line));
  assert.deepEqual(left, []);
});

test('выбор палитры ставит переменные на body, запоминается, откат возвращает розовую', () => {
  const { document } = new JSDOM('<!doctype html><body></body>').window;
  const settings = migrateSettings({});
  const tabs = {};
  const shared = { hub: { addTab: (id) => { const pane = document.createElement('div'); document.body.append(pane); tabs[id] = pane; return { pane, remove: () => pane.remove() }; } } };
  let saved = 0;
  const undo = startPalette(document, { settings, save: () => { saved++; }, shared });
  assert.equal(document.body.style.getPropertyValue('--pud-bg'), '');
  tabs.palette.querySelector('[data-palette="noir"]').click();
  assert.equal(settings.palette, 'noir');
  assert.equal(saved, 1);
  assert.equal(document.body.style.getPropertyValue('--pud-bg'), '#111113');
  assert.ok(document.body.classList.contains(DARK_CLASS));
  assert.equal(tabs.palette.querySelector('.pud-pal.on').dataset.palette, 'noir');
  tabs.palette.querySelector('[data-palette="latte"]').click();
  assert.equal(document.body.classList.contains(DARK_CLASS), false);
  undo();
  assert.equal(document.body.style.getPropertyValue('--pud-bg'), '');
  assert.equal(document.body.style.getPropertyValue('--pud-paw'), '');
});

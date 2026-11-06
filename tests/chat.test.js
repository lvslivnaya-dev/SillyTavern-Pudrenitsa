import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { REGEN_ID, SKIP_CLASS, markTimeskips, startChat, unmarkTimeskips } from '../src/ui/chat.js';

const page = body => new JSDOM(`<!doctype html><body>${body}</body>`, { pretendToBeVisual: true }).window;

test('таймскипы во всех написаниях становятся разделителем', () => {
  const { document } = page('<div class="mes_text"><p>[Timeskip · спустя два часа]</p><p>[Timeskeep 3 дня]</p><p>[Таймскип: утро]</p><p>[Тайм-скип]</p><p>[time skip]</p></div>');
  const root = document.querySelector('.mes_text');
  assert.equal(markTimeskips(root), 5);
  const spans = [...root.querySelectorAll(`.${SKIP_CLASS}`)].map(span => span.textContent);
  assert.deepEqual(spans, ['Timeskip · спустя два часа', 'Timeskeep 3 дня', 'Таймскип: утро', 'Тайм-скип', 'time skip']);
  assert.equal(markTimeskips(root), 0, 'повторный проход ничего не трогает');
});

test('обычные скобки, код и похожие слова не трогаются', () => {
  const { document } = page('<div class="mes_text"><p>[Локация: бар]</p><p>[Timeskipper]</p><code>[Timeskip]</code></div>');
  assert.equal(markTimeskips(document.querySelector('.mes_text')), 0);
});

test('таймскип посреди текста вырезается, текст вокруг остаётся', () => {
  const { document } = page('<div class="mes_text"><p>Она ушла. [Timeskip ночь] Утром позвонили.</p></div>');
  const root = document.querySelector('.mes_text');
  markTimeskips(root);
  assert.equal(root.querySelector('p').childNodes.length, 3);
  assert.equal(root.textContent, 'Она ушла. Timeskip ночь Утром позвонили.');
  unmarkTimeskips(root);
  assert.equal(root.textContent, 'Она ушла. [Timeskip ночь] Утром позвонили.');
});

test('startChat ставит кнопку перегенерации перед «продолжить», она жмёт родной пункт, откат убирает всё', async () => {
  const win = page('<div id="chat"><div class="mes"><div class="mes_text"><p>[Timeskip]</p></div></div></div><div id="rightSendForm"><div id="mes_continue"></div><div id="send_but"></div></div><a id="option_regenerate"></a>');
  const { document } = win;
  let clicks = 0;
  document.getElementById('option_regenerate').addEventListener('click', () => { clicks++; });
  const undo = startChat(document);
  const button = document.getElementById(REGEN_ID);
  assert.ok(button);
  assert.equal(button.nextElementSibling.id, 'mes_continue');
  button.click();
  assert.equal(clicks, 1);
  assert.equal(document.querySelectorAll(`.${SKIP_CLASS}`).length, 1, 'чат обработан сразу');

  const mes = document.createElement('div');
  mes.className = 'mes_text';
  mes.innerHTML = '<p>[Timeskip вечер]</p>';
  document.getElementById('chat').append(mes);
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(document.querySelectorAll(`.${SKIP_CLASS}`).length, 2, 'новое сообщение подхвачено наблюдателем');

  undo();
  assert.equal(document.getElementById(REGEN_ID), null);
  assert.equal(document.querySelectorAll(`.${SKIP_CLASS}`).length, 0);
  assert.match(document.getElementById('chat').textContent, /\[Timeskip вечер\]/);
});

test('без нужной разметки таверны startChat ничего не ломает', () => {
  const { document } = page('');
  const undo = startChat(document);
  assert.equal(document.getElementById(REGEN_ID), null);
  undo();
});

/**
 * «Что сработало из лорбуков»: после каждой генерации видно, какие записи вошли в промпт,
 * каким ключом их зацепило, и какие нашлись, но не вошли (и почему).
 *
 * Откуда данные: таверна пишет подробности сканирования в console.debug, регистратор
 * (core/lore-trace.js) читает их, а событие WORLDINFO_SCAN_DONE даёт точный список вошедших.
 * Отчёт ложится в message.extra.pud_lore ответа (у каждого свайпа свой) и переживает перезагрузку.
 * Под ответом значок «ключик N», по клику — окно с разбором. Там же «Проверить сейчас»:
 * пробный прогон таверны (dry run), который ничего не отправляет.
 */
import { report } from '../core/guard.js';
import { createRecorder, storable, chipText, byBook, matches, howText, whyText, positionLabel, EXTRA_KEY } from '../core/lore-trace.js';
import { createWindow } from './window.js';
import { icon } from './icons.js';

export const CHIP_CLASS = 'pud-ltchip';
export const MENU_ID = 'pud-opt-loretrace';
export const WIN_ID = 'loretrace';

const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const live = () => globalThis.SillyTavern?.getContext?.();
// генерации, у которых ответа в чате нет: их отчёт виден только как «последнее сканирование»
const NO_MESSAGE = new Set(['quiet', 'impersonate']);
// сообщения, которые появляются без генерации
const NOT_GENERATED = new Set(['first_message', 'command', 'extension']);
const TYPE_NAMES = { normal: 'ответ', swipe: 'свайп', regenerate: 'перегенерация', continue: 'продолжение', impersonate: 'за персону', quiet: 'фоновый запрос расширения' };

const fmt = number => Number(number || 0).toLocaleString('ru-RU');
const timeOf = iso => { try { return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

/** Перехват console.debug / console.log: строки идут регистратору, дальше как обычно. */
export function tapConsole(target, feed) {
  const undo = [];
  for (const method of ['debug', 'log']) {
    const original = target[method];
    if (typeof original !== 'function') continue;
    const wrapped = function (...args) {
      try { feed(args); } catch (error) { report('что сработало: разбор строки консоли', error); }
      return original.apply(this, args);
    };
    target[method] = wrapped;
    // если поверх нас обернул кто-то ещё, не ломаем его цепочку: просто перестаём читать
    undo.push(() => { if (target[method] === wrapped) target[method] = original; });
  }
  return () => { for (const fn of undo) fn(); };
}

/**
 * @param {Document} doc
 * @param {{ context: any, settings: any, save?: () => void, shared?: any, consoleTarget?: any }} deps
 */
export function startLoreTrace(doc, { context, settings, save = () => {}, shared = {}, consoleTarget = console }) {
  const view = doc.defaultView;
  const undo = [];
  const ctx = () => live() ?? context;
  settings.loreTrace ??= { chips: true };
  const prefs = settings.loreTrace;

  const state = {
    last: null,      // последнее настоящее сканирование (со списком «не нашлись»)
    pending: null,   // ждёт своего ответа
    check: null,     // последняя «Проверить сейчас»
    wantCheck: false,
    view: 'last',    // 'last' | 'check' | номер сообщения
    query: '',
    checking: false,
  };
  let stopped = false;
  let reading = true;
  let win = null;
  let parts = null;

  // ---------- сбор ----------
  const recorder = createRecorder();
  const tokenCache = new Map();
  const countTokens = async record => {
    const counter = ctx()?.getTokenCountAsync;
    if (typeof counter !== 'function') return;
    let total = 0;
    for (const item of record.on) {
      if (!item.content) continue;
      if (!tokenCache.has(item.content)) {
        try { tokenCache.set(item.content, await counter(item.content)); } catch { tokenCache.set(item.content, 0); }
        if (tokenCache.size > 2000) tokenCache.clear();
      }
      item.tok = tokenCache.get(item.content) ?? 0;
      total += item.tok;
    }
    record.tokens = total;
  };

  const onRecord = record => {
    if (record.dry) {
      if (!state.wantCheck) return; // пробные прогоны таверны (подсчёт токенов в пресете) не наши
      state.wantCheck = false;
      state.check = record;
      countTokens(record).then(() => { if (stopped) return; state.view = 'check'; renderWindow(); }).catch(error => report('что сработало: токены', error));
      return;
    }
    state.last = record;
    if (!NO_MESSAGE.has(record.type)) state.pending = record;
    countTokens(record).then(() => {
      if (stopped) return;
      // токены досчитались, когда отчёт уже лёг в сообщение: дописываем их туда
      if (record.mesId !== undefined) {
        const stored = ctx()?.chat?.[record.mesId]?.extra?.[EXTRA_KEY];
        if (stored?.at === record.at) {
          stored.tokens = record.tokens;
          for (const item of stored.on) item.tok = record.on.find(on => on.w === item.w && on.u === item.u)?.tok ?? item.tok;
        }
        renderChip(record.mesId);
      }
      if (win?.isOpen && (state.view === 'last' || state.view === record.mesId)) renderWindow();
    }).catch(error => report('что сработало: токены', error));
    if (win?.isOpen && state.view === 'last') renderWindow();
  };

  undo.push(tapConsole(consoleTarget, args => {
    if (!reading) return;
    const record = recorder.line(args);
    if (record) onRecord(record);
  }));
  undo.push(() => { reading = false; });

  /** Кладёт отчёт в ответ (и в его свайп, чтобы пережил листание свайпов). */
  const attach = (mesId, type) => {
    const record = state.pending;
    if (!record || NOT_GENERATED.has(type)) return;
    const chat = ctx()?.chat;
    const message = chat?.[mesId];
    if (!message || message.is_user || message.is_system) return;
    state.pending = null;
    const stored = storable(record);
    message.extra ??= {};
    message.extra[EXTRA_KEY] = stored;
    const swipeExtra = message.swipe_info?.[message.swipe_id]?.extra;
    if (swipeExtra && typeof swipeExtra === 'object') swipeExtra[EXTRA_KEY] = stored;
    record.mesId = Number(mesId);
  };

  // ---------- значки под ответами ----------
  const recordOf = mesId => {
    const stored = ctx()?.chat?.[mesId]?.extra?.[EXTRA_KEY];
    return stored && Array.isArray(stored.on) ? stored : null;
  };
  const renderChip = mesId => {
    const block = doc.querySelector(`#chat .mes[mesid="${Number(mesId)}"] .mes_block`);
    if (!block) return;
    const record = prefs.chips ? recordOf(mesId) : null;
    let chip = block.querySelector(`:scope > .${CHIP_CLASS}`);
    if (!record) { chip?.remove(); return; }
    if (!chip) {
      chip = doc.createElement('button');
      chip.type = 'button';
      chip.className = CHIP_CLASS;
      block.append(chip);
    }
    const { count, title } = chipText(record);
    chip.dataset.mesid = String(mesId);
    chip.title = title;
    chip.classList.toggle('warn', Boolean(record.overflow));
    const html = `${icon('key')}<span>${count}</span>${record.off?.length ? `<span class="pud-ltchip-off">+${record.off.length}</span>` : ''}`;
    if (chip.innerHTML !== html) chip.innerHTML = html;
  };
  let allQueued = false;
  const renderAllChips = () => {
    if (allQueued) return;
    allQueued = true;
    (view.requestAnimationFrame ?? (fn => setTimeout(fn, 0)))(() => {
      allQueued = false;
      if (stopped) return;
      try {
        for (const mes of doc.querySelectorAll('#chat .mes[mesid]')) renderChip(mes.getAttribute('mesid'));
      } catch (error) { report('что сработало: значки', error); }
    });
  };
  const onChipClick = event => {
    const chip = event.target.closest?.(`.${CHIP_CLASS}`);
    if (!chip) return;
    event.preventDefault();
    event.stopPropagation();
    openAt(Number(chip.dataset.mesid));
  };
  const chatEl = doc.getElementById('chat');
  chatEl?.addEventListener('click', onChipClick);
  undo.push(() => chatEl?.removeEventListener('click', onChipClick));
  undo.push(() => { for (const chip of doc.querySelectorAll(`.${CHIP_CLASS}`)) chip.remove(); });

  // ---------- события таверны ----------
  const types = context.eventTypes ?? {};
  const listen = (type, fn) => {
    if (!type || !context.eventSource?.on) return;
    const safeFn = (...args) => { try { return fn(...args); } catch (error) { report('что сработало', error); } };
    context.eventSource.on(type, safeFn);
    undo.push(() => context.eventSource.removeListener?.(type, safeFn));
  };
  listen(types.WORLDINFO_SCAN_DONE, data => { if (reading) recorder.loop(data); });
  listen(types.MESSAGE_SENT, () => { state.pending = null; });
  listen(types.MESSAGE_RECEIVED, (mesId, type) => attach(mesId, type));
  listen(types.CHARACTER_MESSAGE_RENDERED, mesId => renderChip(mesId));
  listen(types.MESSAGE_SWIPED, mesId => { renderChip(mesId); if (win?.isOpen && state.view === Number(mesId)) renderWindow(); });
  listen(types.MESSAGE_UPDATED, mesId => renderChip(mesId));
  listen(types.MESSAGE_DELETED, () => { renderAllChips(); if (win?.isOpen) renderWindow(); });
  listen(types.MORE_MESSAGES_LOADED, renderAllChips);
  listen(types.CHAT_CHANGED, () => {
    state.last = null; state.pending = null; state.check = null; state.view = 'last';
    renderAllChips();
    if (win?.isOpen) renderWindow();
  });
  renderAllChips();

  // ---------- окно ----------

  const messagesWithRecords = () => {
    const chat = ctx()?.chat ?? [];
    const list = [];
    for (let id = chat.length - 1; id >= 0; id--) if (recordOf(id)) list.push(id);
    return list;
  };

  /** Что показываем: { record, label, live } — live = есть список «не нашлись». */
  const current = () => {
    if (state.view === 'check') return state.check ? { record: state.check, live: true } : null;
    if (state.view === 'last') return state.last ? { record: state.last, live: true } : null;
    const stored = recordOf(state.view);
    if (!stored) return null;
    // это тот же прогон, что ещё в памяти: берём полный, со списком «не нашлись»
    if (state.last && state.last.at === stored.at) return { record: { ...state.last, on: stored.on.map(item => ({ ...item, content: undefined })), tokens: stored.tokens ?? state.last.tokens }, live: true };
    return { record: stored, live: false };
  };

  const ensureWindow = () => {
    if (win) return win;
    win = createWindow(doc, { id: WIN_ID, title: 'Что сработало из лорбуков', icon: 'key', width: 640, store: settings.windows, save });
    win.element.classList.add('pud-ltwin');
    win.body.innerHTML = `
      <div class="pud-ptools pud-lt-tools">
        <button type="button" class="pud-ptool" data-act="prev" title="Ответ раньше">‹</button>
        <select class="text_pole pud-lt-pick" aria-label="Какой ответ показать"></select>
        <button type="button" class="pud-ptool" data-act="next" title="Ответ позже">›</button>
        <button type="button" class="pud-padd" data-act="check" title="Пробный прогон по текущему чату: ничего не отправляет">${icon('search')}<span>Проверить сейчас</span></button>
      </div>
      <div class="pud-ptools pud-lt-tools">
        <label class="pud-search">${icon('search')}<input type="search" placeholder="Искать запись, книгу или ключ" aria-label="Поиск записей"></label>
        <label class="pud-lt-opt"><input type="checkbox" data-act="chips"><span>значки под ответами</span></label>
      </div>
      <div class="pud-lt-sum"></div>
      <div class="pud-lt-body"></div>`;
    parts = {
      pick: win.body.querySelector('.pud-lt-pick'),
      search: win.body.querySelector('input[type="search"]'),
      chips: win.body.querySelector('[data-act="chips"]'),
      sum: win.body.querySelector('.pud-lt-sum'),
      body: win.body.querySelector('.pud-lt-body'),
      check: win.body.querySelector('[data-act="check"]'),
    };
    parts.pick.addEventListener('change', () => {
      const value = parts.pick.value;
      state.view = value === 'last' || value === 'check' ? value : Number(value);
      renderWindow();
    });
    parts.search.addEventListener('input', () => { state.query = parts.search.value; renderWindow(); });
    parts.chips.addEventListener('change', () => { prefs.chips = parts.chips.checked; save(); renderAllChips(); });
    win.body.addEventListener('click', event => {
      const act = event.target.closest('[data-act]')?.dataset.act;
      if (act === 'prev' || act === 'next') { step(act === 'prev' ? 1 : -1); return; }
      if (act === 'check') { runCheck(); return; }
      const open = event.target.closest('[data-book]');
      if (open) {
        const uid = Number(open.dataset.uid);
        const book = open.dataset.book;
        if (shared.loreEditor?.open) shared.loreEditor.open(book, Number.isFinite(uid) ? uid : null);
        else globalThis.toastr?.info?.(`Запись в лорбуке «${book}», UID ${open.dataset.uid}.`, 'Пудреница');
      }
    });
    undo.push(() => { win.destroy(); win = null; });
    return win;
  };

  /** Листаем ответы с отчётами: dir 1 = раньше, -1 = позже. */
  const step = dir => {
    const list = messagesWithRecords();
    if (!list.length) return;
    if (typeof state.view !== 'number') { state.view = list[0]; renderWindow(); return; }
    const index = list.indexOf(state.view);
    const next = list[Math.min(Math.max((index < 0 ? 0 : index) + dir, 0), list.length - 1)];
    state.view = next;
    renderWindow();
  };

  const runCheck = async () => {
    const c = ctx();
    if (!c?.getCurrentChatId?.()) { globalThis.toastr?.info?.('Сначала открой чат.', 'Пудреница'); return; }
    if (state.checking) return;
    state.checking = true;
    parts.check.disabled = true;
    state.wantCheck = true;
    try {
      await c.generate('normal', {}, true);
      if (state.wantCheck) {
        state.wantCheck = false;
        globalThis.toastr?.info?.('Таверна не стала сканировать лорбуки: может, к чату не подключено ни одной книги.', 'Пудреница');
      }
    } catch (error) {
      state.wantCheck = false;
      report('что сработало: проверка', error);
      globalThis.toastr?.error?.('Проверка не получилась. Подробности в консоли (F12).', 'Пудреница');
    } finally {
      state.checking = false;
      if (parts) parts.check.disabled = false;
    }
  };

  const rowOn = item => `<li class="pud-lt-row">
      <button type="button" class="pud-lt-open" data-book="${escapeHtml(item.w)}" data-uid="${escapeHtml(item.u)}" title="Открыть запись в редакторе">${escapeHtml(item.t)}</button>
      <span class="pud-lt-how pud-lt-${escapeHtml(item.how)}">${escapeHtml(howText(item))}</span>
      <span class="pud-lt-tags">
        ${item.rec ? '<span class="pud-lt-tag" title="Её ключ нашёлся в тексте другой сработавшей записи">от другой записи</span>' : ''}
        ${item.deep ? '<span class="pud-lt-tag" title="Нашлась глубже обычного: таверна добирала минимум срабатываний">глубже</span>' : ''}
        ${positionLabel(item.pos, item.depth) ? `<span class="pud-lt-tag">${escapeHtml(positionLabel(item.pos, item.depth))}</span>` : ''}
        ${item.tok ? `<span class="pud-tech">~${fmt(item.tok)} ток.</span>` : ''}
      </span>
    </li>`;
  const rowOff = item => `<li class="pud-lt-row off">
      <button type="button" class="pud-lt-open" data-book="${escapeHtml(item.w)}" data-uid="${escapeHtml(item.u)}" title="Открыть запись в редакторе">${escapeHtml(item.t)}</button>
      <span class="pud-lt-why">${escapeHtml(whyText(item))}</span>
      ${item.key ? `<span class="pud-lt-tags"><span class="pud-lt-tag">ключ «${escapeHtml(item.key)}»</span></span>` : ''}
    </li>`;
  const rowMiss = item => `<li class="pud-lt-row miss">
      <button type="button" class="pud-lt-open" data-book="${escapeHtml(item.w)}" data-uid="${escapeHtml(item.u)}" title="Открыть запись в редакторе">${escapeHtml(item.t)}</button>
      <span class="pud-lt-tags">${item.keys.length ? item.keys.map(key => `<span class="pud-lt-tag">${escapeHtml(key)}</span>`).join('') : '<span class="pud-hint">ключей нет</span>'}
      ${item.scan !== null && item.scan !== undefined ? `<span class="pud-tech">ищет в ${fmt(item.scan)} последн. сообщ.</span>` : ''}</span>
    </li>`;
  const groups = (items, row) => byBook(items).map(group => `<div class="pud-lt-book"><h5>${escapeHtml(group.book)}</h5><ul>${group.items.map(row).join('')}</ul></div>`).join('');

  const renderPick = () => {
    const chat = ctx()?.chat ?? [];
    const options = [];
    if (state.last) options.push(['last', `Последнее сканирование · ${TYPE_NAMES[state.last.type] ?? state.last.type} · ${timeOf(state.last.at)}`]);
    if (state.check) options.push(['check', `Проверка · ${timeOf(state.check.at)}`]);
    for (const id of messagesWithRecords()) options.push([String(id), `№ ${id} · ${chat[id]?.name ?? ''}`]);
    if (!options.length) options.push(['last', 'Пока ни одного сканирования']);
    const html = options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${String(state.view) === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
    // select не перерисовываем без нужды: иначе он закрывается под мышкой
    if (parts.pick.dataset.html !== html) { parts.pick.innerHTML = html; parts.pick.dataset.html = html; }
  };

  const renderWindow = () => {
    if (!win || !parts) return;
    try {
      parts.chips.checked = Boolean(prefs.chips);
      renderPick();
      const shown = current();
      if (!shown) {
        parts.sum.innerHTML = '';
        parts.body.innerHTML = `<p class="pud-hint">${state.view === 'check' ? 'Нажми «Проверить сейчас».' : 'Здесь появится разбор после следующей генерации. Можно и сразу: «Проверить сейчас» прогонит сканирование по текущему чату, ничего не отправляя.'}</p>`;
        return;
      }
      const { record, live: full } = shown;
      const q = state.query;
      const on = record.on.filter(item => matches(item, q));
      const off = (record.off ?? []).filter(item => matches(item, q));
      const miss = full ? (record.miss ?? []).filter(item => matches(item, q)) : [];
      const tokens = record.tokens ?? record.on.reduce((sum, item) => sum + (item.tok || 0), 0);
      const share = record.limit ? Math.min(100, Math.round(tokens / record.limit * 100)) : 0;
      parts.sum.innerHTML = `
        <p><b>${record.dry ? 'Проверка' : escapeHtml(TYPE_NAMES[record.type] ?? record.type)}</b> · ${timeOf(record.at)} · вошло записей: <b>${record.on.length}</b>${record.off?.length ? ` · нашлось, но не вошло: ${record.off.length}` : ''}</p>
        ${record.limit ? `<div class="pud-lt-bar${record.overflow ? ' warn' : ''}" title="Сколько бюджета лорбуков заняли записи"><span style="width:${share}%"></span></div>
        <p class="pud-tech">~${fmt(tokens)} из ${fmt(record.limit)} токенов бюджета${record.overflow ? ' · бюджет переполнен, часть записей не влезла' : ''}</p>` : ''}
        ${record.dry ? '<p class="pud-hint">Пробный прогон: текст в поле ввода не учитывается, шанс срабатывания бросается заново.</p>' : ''}`;
      parts.body.innerHTML = `
        <section class="pud-lt-sec"><h4>Вошли в промпт</h4>${on.length ? groups(on, rowOn) : '<p class="pud-hint">Ни одной.</p>'}</section>
        ${off.length ? `<section class="pud-lt-sec"><h4>Нашлись, но не вошли</h4>${groups(off, rowOff)}</section>` : ''}
        ${full
          ? (miss.length ? `<details class="pud-lt-sec"><summary><h4>Ключ не встретился в чате · ${miss.length}</h4></summary>${groups(miss, rowMiss)}</details>` : '')
          : '<p class="pud-hint">Список записей, чей ключ не встретился, есть только у последнего сканирования и у проверки.</p>'}`;
    } catch (error) { report('что сработало: окно', error); }
  };

  const openAt = target => {
    ensureWindow();
    state.view = target ?? (state.last ? 'last' : messagesWithRecords()[0] ?? 'last');
    win.open();
    renderWindow();
  };
  shared.loreTrace = { open: openAt };
  undo.push(() => { delete shared.loreTrace; });

  // ---------- пункт в меню лапки ----------
  const addMenu = () => {
    const content = doc.querySelector('#options .options-content');
    if (!content || doc.getElementById(MENU_ID)) return Boolean(content);
    const item = doc.createElement('a');
    item.id = MENU_ID;
    item.innerHTML = '<i class="fa-lg fa-solid fa-key"></i><span>Что сработало из лорбуков</span>';
    item.addEventListener('click', () => openAt());
    const after = doc.getElementById('pud-opt-chatlore');
    if (after) after.after(item); else content.append(item);
    undo.push(() => item.remove());
    return true;
  };
  if (!addMenu()) {
    const observer = new view.MutationObserver(() => { if (addMenu()) observer.disconnect(); });
    observer.observe(doc.body, { childList: true, subtree: true });
    undo.push(() => observer.disconnect());
  }

  return () => {
    stopped = true;
    for (const fn of undo.reverse()) { try { fn(); } catch (error) { report('откат «что сработало»', error); } }
  };
}

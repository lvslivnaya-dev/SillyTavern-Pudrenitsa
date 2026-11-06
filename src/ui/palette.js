/**
 * Палитра Пудреницы: переменные цветов на body и вкладка «Палитра» в окне «Пудреница».
 * Выбор — как радиокнопка: нажала на палитру, и она сразу применилась и запомнилась.
 */
import { report } from '../core/guard.js';
import { DEFAULT_PALETTE, PALETTES, paletteById, paletteVars } from '../core/palettes.js';

export const DARK_CLASS = 'pud-dark';
const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

/** Ставит палитру на body. Возвращает имена переменных, которые поставила. */
export function applyPalette(doc, id, previous = []) {
  const body = doc.body;
  for (const name of previous) body.style.removeProperty(name);
  const vars = paletteVars(id);
  for (const [name, value] of Object.entries(vars)) body.style.setProperty(name, value);
  body.classList.toggle(DARK_CLASS, paletteById(id).dark);
  return Object.keys(vars);
}

/**
 * @param {Document} doc
 * @param {{ settings: any, save: () => void, shared?: any }} deps
 */
export function startPalette(doc, { settings, save, shared = {} }) {
  if (!PALETTES.some(item => item.id === settings.palette)) settings.palette = DEFAULT_PALETTE;
  let applied = applyPalette(doc, settings.palette);
  const undo = [() => { applyPalette(doc, DEFAULT_PALETTE, applied); doc.body.classList.remove(DARK_CLASS); }];

  const tab = shared.hub?.addTab?.('palette', 'Палитра', 'wand');
  if (tab) {
    undo.push(() => tab.remove());
    const render = () => {
      tab.pane.innerHTML = `
        <h3>Палитра</h3>
        <p class="pud-hint">Цвета всей Пудреницы: окна, кнопки, чат. Нажми на палитру, и она сразу включится.</p>
        <div class="pud-palettes" role="radiogroup" aria-label="Палитра">
          ${PALETTES.map(p => `<button type="button" class="pud-pal${p.id === settings.palette ? ' on' : ''}" data-palette="${p.id}" role="radio" aria-checked="${p.id === settings.palette}">
              <span class="pud-pal-swatch" style="background:${p.bg}">
                <span style="background:${p.card};border-color:${p.line}"></span>
                <span style="background:${p.accent}"></span>
                <span style="background:${p.accent3}"></span>
                <span style="background:${p.ink}"></span>
              </span>
              <b>${escapeHtml(p.title)}</b>
              <small>${escapeHtml(p.hint)}</small>
            </button>`).join('')}
        </div>`;
    };
    render();
    tab.pane.addEventListener('click', event => {
      const choice = event.target.closest('[data-palette]')?.dataset.palette;
      if (!choice || choice === settings.palette) return;
      try {
        settings.palette = choice;
        applied = applyPalette(doc, choice, applied);
        save();
        render();
      } catch (error) { report('палитра', error); }
    });
  }
  return () => { for (const fn of undo.reverse()) fn(); };
}

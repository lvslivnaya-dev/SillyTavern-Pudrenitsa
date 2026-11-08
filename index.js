/** Пудреница: точка входа. Каждый модуль стартует отдельно, и ошибка одного не мешает остальным. */
import { TAG, report } from './src/core/guard.js';
import { getSettings } from './src/core/settings.js';
import { injectFonts } from './src/ui/fonts.js';
import { injectSprite } from './src/ui/icons.js';
import { startTheme } from './src/ui/theme.js';
import { startChat } from './src/ui/chat.js';
import { startInputBar } from './src/ui/inputbar.js';
import { startHider } from './src/ui/hider.js';
import { startWalkCat } from './src/ui/walkcat.js';
import { startHub } from './src/ui/hub.js';
import { startChips } from './src/ui/chips.js';
import { startPalette } from './src/ui/palette.js';
import { startHome } from './src/ui/home.js';
import { startPersonas } from './src/ui/personas.js';
import { startPersonaSwitch } from './src/ui/persona-switch.js';
import { startCharacters } from './src/ui/characters.js';
import { startExtensions } from './src/ui/extensions.js';
import { startLorebooks } from './src/ui/lorebooks.js';
import { startLoreEditor } from './src/ui/lore-editor.js';

const FONT_BASE = new URL('./assets/fonts/', import.meta.url);

/** start({ context, settings }) может вернуть функцию отката: она снимает всё, что модуль добавил. */
const MODULES = [
  { name: 'шрифты', start: () => injectFonts(document, FONT_BASE) },
  { name: 'иконки', start: () => injectSprite(document) },
  { name: 'тема', start: ({ context }) => startTheme(document, context) },
  { name: 'чат', start: () => startChat(document) },
  { name: 'кнопки поля ввода', start: ({ shared }) => startInputBar(document, { shared }) },
  { name: 'скрыть сообщения', start: ({ context }) => startHider(document, { context }) },
  { name: 'котик при стриминге', start: ({ context }) => startWalkCat(document, { context }) },
  {
    name: 'окно Пудреница',
    start: ({ context, settings, stopAll, shared }) => startHub(document, { settings, save: () => context.saveSettingsDebounced?.(), stopAll, shared }),
  },
  {
    name: 'палитра',
    start: ({ context, settings, shared }) => startPalette(document, { settings, save: () => context.saveSettingsDebounced?.(), shared, generate: opts => context.generateRaw(opts) }),
  },
  {
    name: 'кнопки пресета',
    start: ({ context, settings, shared }) => startChips(document, { context, settings, save: () => context.saveSettingsDebounced?.(), hub: shared.hub }),
  },
  {
    name: 'библиотека чатов',
    start: ({ context, settings, shared }) => startHome(document, { context, settings, save: () => context.saveSettingsDebounced?.(), shared }),
  },
  {
    name: 'персоны',
    start: ({ context, settings }) => startPersonas(document, { context, settings, save: () => context.saveSettingsDebounced?.() }),
  },
  {
    name: 'быстрая смена персоны',
    start: ({ context, settings }) => startPersonaSwitch(document, { context, settings }),
  },
  {
    name: 'персонажи',
    start: ({ context, settings, shared }) => startCharacters(document, { context, settings, save: () => context.saveSettingsDebounced?.(), shared }),
  },
  {
    name: 'расширения',
    start: ({ context, settings }) => startExtensions(document, { context, settings, save: () => context.saveSettingsDebounced?.() }),
  },
  {
    name: 'лорбуки',
    start: ({ context, settings, shared }) => startLorebooks(document, { context, settings, save: () => context.saveSettingsDebounced?.(), shared }),
  },
  {
    name: 'редактор лорбука',
    start: ({ context, settings, shared }) => startLoreEditor(document, { context, settings, save: () => context.saveSettingsDebounced?.(), shared }),
  },
];

let controller = null;

export async function init() {
  if (controller) return controller;
  const context = globalThis.SillyTavern?.getContext?.();
  if (!context) {
    report('запуск', new Error('нет SillyTavern.getContext()'));
    return null;
  }
  const settings = getSettings(context);
  const running = [];
  const failed = [];
  const stopAll = () => controller?.stop();
  const shared = {};
  if (settings.enabled) {
    for (const module of MODULES) {
      try {
        const undo = await module.start({ context, settings, stopAll, shared });
        if (typeof undo === 'function') running.push({ name: module.name, undo });
      } catch (error) {
        failed.push(module.name);
        report(`модуль «${module.name}»`, error);
      }
    }
  }
  controller = {
    settings,
    failed,
    modules: () => running.map(item => item.name),
    stop() {
      for (const { name, undo } of running.splice(0).reverse()) {
        try { undo(); } catch (error) { report(`откат «${name}»`, error); }
      }
    },
  };
  if (failed.length) console.warn(`${TAG} не запустились: ${failed.join(', ')}`);
  return controller;
}

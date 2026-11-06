/**
 * Палитры Пудреницы. «Пудра» — та, что записана в style.css; остальные меняют те же токены
 * инлайн-переменными на body. Картинки-лапки и ушки — data:-URL, в них переменные не работают,
 * поэтому их собираю здесь под цвета палитры.
 */
export const DEFAULT_PALETTE = 'pink';

const hexToRgb = hex => {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map(ch => ch + ch).join('') : value;
  return [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16)).join(' ');
};

/**
 * Цвета палитры. accent/accent2/accent3 ложатся в токены --pud-rose/--pud-rose2/--pud-rose3:
 * так зовутся в CSS исторически, а значат «акцент», «акцент насыщенный», «акцент мягкий».
 */
export const PALETTES = [
  {
    id: 'pink', title: 'Пудра', hint: 'розовая, как была',
    dark: false,
    bg: '#fbeef3', card: '#ffffff', glass: '#fff9fb', rim: 'rgba(255, 255, 255, 0.85)',
    line: '#f0cbd8', line2: '#f7e1e9', ink: '#5b3a4a', ink2: '#8d6a7a', tech: '#a8949d',
    accent: '#e8899f', accent2: '#d4688a', accent3: '#fbd3de', onAccent: '#ffffff',
    tint: '#fde3ea', tint2: '#fff0f4', puffline: '#f3cbd8', shade: '#be6082',
    lilac: '#b79be0', lilacSoft: '#f3dcf5', mint: '#86cdb3', mintSoft: '#dcf3e9', mintInk: '#3f8a6d',
    butter: '#f2cf7c', butterSoft: '#fff4d9', butterInk: '#8a6a1f', danger: '#c2465f',
    catFur: '#ffffff', catEye: '#5b3a4a',
    narr: '#bd6d9d', speech: '#99ba52', think: '#69318E', skip: '#c08a5a',
  },
  {
    id: 'graphite', title: 'Графит и мёд', hint: 'тёмно-серая с жёлтым',
    dark: true,
    bg: '#26272b', card: '#33343a', glass: '#2c2d32', rim: 'rgba(255, 255, 255, 0.08)',
    line: '#4a4b53', line2: '#3b3c42', ink: '#eceae3', ink2: '#bcb9ae', tech: '#8f8c84',
    accent: '#f2c94c', accent2: '#e2b22d', accent3: '#4f4528', onAccent: '#26272b',
    tint: '#433d2a', tint2: '#3a3931', puffline: '#1d1e21', shade: '#000000',
    lilac: '#b9a6e8', lilacSoft: '#3c3850', mint: '#7cc9ad', mintSoft: '#2e4440', mintInk: '#a3e2c9',
    butter: '#f2cf7c', butterSoft: '#4a4230', butterInk: '#f4d78f', danger: '#ef6b6b',
    catFur: '#e8e4d8', catEye: '#26272b',
    narr: '#e3c77c', speech: '#a9d27c', think: '#bca5f2', skip: '#d8a66c',
  },
  {
    id: 'noir', title: 'Ночь и вишня', hint: 'чёрная с красным',
    dark: true,
    bg: '#111113', card: '#1d1d20', glass: '#18181b', rim: 'rgba(255, 255, 255, 0.06)',
    line: '#3d2a2e', line2: '#2a2124', ink: '#efe7e8', ink2: '#bcaaad', tech: '#8c7e80',
    accent: '#e04a5a', accent2: '#c92f43', accent3: '#4a1c24', onAccent: '#ffffff',
    tint: '#3b1a20', tint2: '#2a1619', puffline: '#08080a', shade: '#000000',
    lilac: '#b78ddb', lilacSoft: '#33263d', mint: '#6fc2a2', mintSoft: '#1f3530', mintInk: '#92dec2',
    butter: '#e8c26a', butterSoft: '#3d3220', butterInk: '#f1d28d', danger: '#ff6b6b',
    catFur: '#2a2a2f', catEye: '#f2c94c',
    narr: '#e5808f', speech: '#b9d17c', think: '#bc9fe9', skip: '#d3986c',
  },
  {
    id: 'latte', title: 'Кофе с молоком', hint: 'кофейная с молочным',
    dark: false,
    bg: '#f3ebe1', card: '#fffaf3', glass: '#fcf6ee', rim: 'rgba(255, 255, 255, 0.8)',
    line: '#dccab4', line2: '#eadfce', ink: '#4a3426', ink2: '#7a5f4c', tech: '#a08b7a',
    accent: '#b07a55', accent2: '#8f5b3a', accent3: '#ead7c2', onAccent: '#fffaf3',
    tint: '#f0e2d0', tint2: '#f8efe4', puffline: '#e2cfb8', shade: '#785032',
    lilac: '#b49ac4', lilacSoft: '#efe3ef', mint: '#8fbf9f', mintSoft: '#e3f0e4', mintInk: '#4f7d5d',
    butter: '#e2b866', butterSoft: '#f7ead0', butterInk: '#7d5c1e', danger: '#b5493d',
    catFur: '#f7e9d6', catEye: '#4a3426',
    narr: '#9a6a4a', speech: '#7f9a45', think: '#6e4a7e', skip: '#b0804f',
  },
  {
    id: 'matcha', title: 'Салат и роза', hint: 'мягкая салатовая с розовым',
    dark: false,
    bg: '#eef5e8', card: '#fcfff9', glass: '#f8fdf4', rim: 'rgba(255, 255, 255, 0.85)',
    line: '#cfe2c2', line2: '#e2eed9', ink: '#3d4a36', ink2: '#6a7a5f', tech: '#95a08c',
    accent: '#e8899f', accent2: '#d4688a', accent3: '#fbd3de', onAccent: '#ffffff',
    tint: '#fde6ec', tint2: '#f3f9ee', puffline: '#d5e6c8', shade: '#6e8c5a',
    lilac: '#b79be0', lilacSoft: '#efe6f7', mint: '#9ccf86', mintSoft: '#e4f2da', mintInk: '#4d7a3c',
    butter: '#f2cf7c', butterSoft: '#fbf3d9', butterInk: '#7d6420', danger: '#c2465f',
    catFur: '#ffffff', catEye: '#3d4a36',
    narr: '#bd6d9d', speech: '#7aa346', think: '#69318E', skip: '#b98a52',
  },
];

export const paletteById = id => PALETTES.find(item => item.id === id) ?? PALETTES[0];

const enc = color => color.replace('#', '%23');
const PAW = "%3Cellipse cx='12' cy='15.5' rx='5' ry='4.2'/%3E%3Cellipse cx='5.6' cy='10' rx='2' ry='2.6'/%3E%3Cellipse cx='9.4' cy='6.2' rx='2' ry='2.7'/%3E%3Cellipse cx='14.6' cy='6.2' rx='2' ry='2.7'/%3E%3Cellipse cx='18.4' cy='10' rx='2' ry='2.6'/%3E";
const svg = body => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' ${body}%3C/svg%3E")`;

/** Картинки палитры: лапка, бледные лапки фона, белая лапка, ушки. */
export function paletteImages(p) {
  return {
    '--pud-paw': svg(`viewBox='0 0 24 24' fill='${enc(p.accent)}'%3E${PAW}`),
    '--pud-paw-faint': svg(`viewBox='0 0 120 120' fill='${enc(p.accent2)}' fill-opacity='${p.dark ? 0.2 : 0.28}'%3E%3Cg transform='translate(18 20) rotate(-14 12 12)'%3E${PAW}%3C/g%3E%3Cg transform='translate(76 72) rotate(12 12 12)'%3E${PAW}%3C/g%3E`),
    '--pud-paw-white': svg(`viewBox='0 0 24 24' fill='${enc(p.onAccent)}'%3E${PAW}`),
    '--pud-ears': svg(`viewBox='0 0 80 22'%3E%3Cg stroke='${enc(p.line)}' stroke-width='1.2' stroke-linejoin='round'%3E%3Cpath d='M3 22 Q8 3 15 1.5 Q22 3 27 22Z' fill='${enc(p.tint2)}'/%3E%3Cpath d='M53 22 Q58 3 65 1.5 Q72 3 77 22Z' fill='${enc(p.tint2)}'/%3E%3C/g%3E%3Cg fill='${enc(p.accent3)}'%3E%3Cpath d='M9 22 Q12 9 15 8 Q18 9 21 22Z'/%3E%3Cpath d='M59 22 Q62 9 65 8 Q68 9 71 22Z'/%3E%3C/g%3E`),
  };
}

/** Переменные палитры для body.style. «Пудре» они не нужны: она уже в style.css. */
export function paletteVars(id) {
  const p = paletteById(id);
  if (p.id === DEFAULT_PALETTE) return {};
  const glass = hexToRgb(p.glass);
  const [r, g, b] = hexToRgb(p.accent).split(' ');
  return {
    '--pud-bg': p.bg,
    '--pud-glass': `rgb(${glass} / ${p.dark ? 0.8 : 0.7})`,
    '--pud-glass-hi': `rgb(${glass} / ${p.dark ? 0.94 : 0.9})`,
    '--pud-glass-lo': `rgb(${glass} / ${p.dark ? 0.55 : 0.45})`,
    '--pud-rim': p.rim,
    '--pud-line': p.line, '--pud-line2': p.line2,
    '--pud-ink': p.ink, '--pud-ink2': p.ink2, '--pud-tech': p.tech,
    '--pud-rose': p.accent, '--pud-rose2': p.accent2, '--pud-rose3': p.accent3,
    '--pud-lilac': p.lilac, '--pud-mint': p.mint, '--pud-butter': p.butter, '--pud-danger': p.danger,
    '--pud-narr': p.narr, '--pud-speech': p.speech, '--pud-think': p.think, '--pud-skip': p.skip,
    '--pud-card': p.card, '--pud-on-accent': p.onAccent,
    '--pud-tint': p.tint, '--pud-tint2': p.tint2, '--pud-puffline': p.puffline,
    '--pud-lilac-soft': p.lilacSoft, '--pud-mint-soft': p.mintSoft, '--pud-mint-ink': p.mintInk,
    '--pud-butter-soft': p.butterSoft, '--pud-butter-ink': p.butterInk,
    '--pud-cat-fur': p.catFur, '--pud-cat-eye': p.catEye,
    '--pud-card-rgb': hexToRgb(p.card), '--pud-glass-rgb': glass, '--pud-shade-rgb': hexToRgb(p.shade),
    '--pud-rose-rgb': hexToRgb(p.accent), '--pud-rose2-rgb': hexToRgb(p.accent2), '--pud-rose3-rgb': hexToRgb(p.accent3),
    '--pud-lilac-soft-rgb': hexToRgb(p.lilacSoft), '--pud-mint-soft-rgb': hexToRgb(p.mintSoft), '--pud-butter-soft-rgb': hexToRgb(p.butterSoft),
    '--SmartThemeCheckboxBgColorR': r, '--SmartThemeCheckboxBgColorG': g, '--SmartThemeCheckboxBgColorB': b,
    ...paletteImages(p),
  };
}

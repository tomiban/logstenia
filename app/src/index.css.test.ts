/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(new URL('./index.css', import.meta.url), 'utf8');

/** Custom property declarations of the first block that starts with `selector`. */
function block(selector: string): Record<string, string> {
  const escaped = selector.replace('.', '\\.');
  const match = new RegExp(`(?:^|\\n)\\s*${escaped}[^{]*\\{`, 'm').exec(CSS);
  if (!match) return {};
  const start = match.index + match[0].length;
  const body = CSS.slice(start, CSS.indexOf('}', start));
  const decls: Record<string, string> = {};
  for (const decl of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) decls[decl[1]] = decl[2].trim();
  return decls;
}

const root = block(':root');
const dark = block('.dark');

/** Value of a token in one mode, following `var()` chains across `:root` and `.dark`. */
function token(name: string, mode: Record<string, string>): string | undefined {
  let value = mode[name] ?? root[name];
  for (let hops = 0; hops < 5 && value?.startsWith('var('); hops++) {
    const ref = value.slice(6, -1).trim();
    value = mode[ref] ?? root[ref];
  }
  return value;
}

function color(name: string, mode: Record<string, string>): string {
  const value = token(name, mode);
  expect(value, `--${name} debe ser un color hex en este modo`).toMatch(/^#[0-9a-f]{6}$/i);
  return value as string;
}

function luminance(hex: string): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hex.replace('#', '').match(/../g)!.map((h) => lin(parseInt(h, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;

const pairs: [string, string][] = [
  ['ink', 'bg'],
  ['ink', 'card'],
  ['on-ink', 'ink'],
  ['on-accent', 'accent'],
  ['primary-foreground', 'primary'],
  ['foreground-shadcn', 'background'],
  ['muted-foreground', 'card'],
  ['muted', 'bg'],
  ['destructive', 'card'],
];

describe.each([
  { name: 'light', tokens: root },
  { name: 'dark', tokens: dark },
])('$name: contraste de los tokens semánticos', ({ tokens }) => {
  it.each(pairs)('%s sobre %s alcanza el mínimo de texto', (fg, bg) => {
    expect(contrast(color(fg, tokens), color(bg, tokens))).toBeGreaterThanOrEqual(TEXT);
  });
});

describe('tokens declarados', () => {
  it('lee los bloques de ambos modos', () => {
    expect(Object.keys(root).length).toBeGreaterThan(20);
    expect(Object.keys(dark).length).toBeGreaterThan(10);
  });
});

describe('dark: superficies de relleno', () => {
  it('el relleno secundario se separa de la tarjeta sin dejar de ser sutil', () => {
    const ratio = contrast(color('muted-surface', dark), color('card', dark));
    expect(ratio).toBeGreaterThanOrEqual(1.15);
    expect(ratio).toBeLessThanOrEqual(2.5);
  });
});

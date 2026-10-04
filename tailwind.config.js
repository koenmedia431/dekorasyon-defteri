/** @type {import('tailwindcss').Config} */

// Renkler src/theme.css'teki CSS değişkenlerinden gelir; koyu temada aynı sınıflar
// koyu karşılıklarına döner. Tür renkleri (debit/credit/expense) grafik için renk körlüğüne
// göre doğrulandı: açık mavi/su yeşili/turuncu, koyu temada adım adım ayarlanmış karşılıkları.
const v = name => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (p, keys) => Object.fromEntries(keys.map(k => [k, v(`${p}-${k}`)]));
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

// Menü gibi her iki temada da koyu kalan yüzeyler için sabit (değişmeyen) palet
const ink = { 0: '#ffffff', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#070b16' };

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
      colors: {
        white: v('white'),
        slate: scale('slate', [...SHADES, 950]),
        red: scale('red', SHADES),
        debit: scale('debit', SHADES),
        credit: scale('credit', SHADES),
        expense: scale('expense', SHADES),
        advance: scale('advance', SHADES),
        ink,
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 1px 3px rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [],
};

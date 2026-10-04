import { useEffect, useState } from 'react';

// Açık / Koyu / Sistem teması. Tercih tarayıcıda saklanır; ilk boyamadan önce index.html'deki
// küçük betik uygular (yanıp sönme olmasın).
export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'defter.theme';

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function systemDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function applyTheme(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && systemDark());
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a0f1c' : '#0f172a');
}

export function useTheme(): [ThemePref, (p: ThemePref) => void, boolean] {
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    applyTheme(pref);
    setIsDark(document.documentElement.classList.contains('dark'));
    try {
      if (pref === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, pref);
    } catch {
      /* depolama kapalı: sadece bu oturumda geçerli */
    }
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      applyTheme('system');
      setIsDark(mq.matches);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);

  return [pref, setPref, isDark];
}

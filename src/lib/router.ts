import { useEffect, useState } from 'react';

// Basit hash yönlendirme: GitHub Pages'te sunucu ayarı gerektirmez, telefonda geri tuşu çalışır.
export type Route =
  | { name: 'dashboard' }
  | { name: 'customers'; id?: string }
  | { name: 'advances' }
  | { name: 'settings' };

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'musteriler':
      return { name: 'customers', id: parts[1] };
    case 'avanslar':
      return { name: 'advances' };
    case 'ayarlar':
      return { name: 'settings' };
    default:
      return { name: 'dashboard' };
  }
}

export function href(route: Route): string {
  switch (route.name) {
    case 'customers':
      return route.id ? `#/musteriler/${route.id}` : '#/musteriler';
    case 'advances':
      return '#/avanslar';
    case 'settings':
      return '#/ayarlar';
    default:
      return '#/';
  }
}

export function navigate(route: Route, replace = false) {
  const target = href(route);
  if (replace) history.replaceState(null, '', target);
  else window.location.hash = target;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

import { LayoutDashboard, Users, HandCoins, Settings, LogOut, BookOpen, Sun, Moon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { href, type Route } from '@/lib/router';
import { useSettings } from '@/lib/settings';
import { useTheme } from '@/lib/theme';

const ITEMS: { route: Route; label: string; short: string; icon: typeof Users }[] = [
  { route: { name: 'dashboard' }, label: 'Genel Bakış', short: 'Özet', icon: LayoutDashboard },
  { route: { name: 'customers' }, label: 'Müşteriler', short: 'Müşteriler', icon: Users },
  { route: { name: 'advances' }, label: 'Ortak Avansları', short: 'Avanslar', icon: HandCoins },
  { route: { name: 'settings' }, label: 'Ayarlar', short: 'Ayarlar', icon: Settings },
];

// Masaüstü sol menü (her iki temada da koyu: sabit "ink" paleti)
export function NavRail({ route, userEmail, customerCount }: { route: Route; userEmail: string; customerCount: number }) {
  const { settings, logoUrl } = useSettings();
  const [pref, setPref, isDark] = useTheme();
  return (
    <nav className="no-print hidden w-60 flex-shrink-0 flex-col bg-ink-900 text-ink-300 dark:bg-ink-950 lg:flex">
      <div className="flex items-center gap-3 px-5 py-5">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-9 w-9 rounded-lg bg-ink-0 object-contain p-0.5" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2a78d6] text-ink-0">
            <BookOpen className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-0">{settings.name || 'Müşteri Defteri'}</p>
          <p className="text-[11px] text-ink-500">Dekorasyon & İnşaat</p>
        </div>
      </div>
      <div className="flex-1 space-y-0.5 px-3">
        {ITEMS.map(item => {
          const active = item.route.name === route.name;
          return (
            <a
              key={item.label}
              href={href(item.route)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-ink-0/10 text-ink-0' : 'hover:bg-ink-0/5 hover:text-ink-0'
              }`}
            >
              <item.icon className={`h-4 w-4 ${active ? 'text-[#6da7ec]' : 'text-ink-500'}`} />
              <span className="flex-1">{item.label}</span>
              {item.route.name === 'customers' && customerCount > 0 && (
                <span className="tabular rounded-full bg-ink-0/10 px-1.5 text-[11px] text-ink-300">{customerCount}</span>
              )}
            </a>
          );
        })}
      </div>
      <div className="space-y-2 border-t border-ink-0/10 px-4 py-3">
        <button
          onClick={() => setPref(isDark ? 'light' : 'dark')}
          className="flex items-center gap-2 text-xs font-medium text-ink-400 hover:text-ink-0"
          title={pref === 'system' ? 'Tema: sistem ayarı' : undefined}
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {isDark ? 'Açık tema' : 'Koyu tema'}
        </button>
        <div>
          <p className="truncate text-xs text-ink-500">{userEmail}</p>
          <button onClick={() => supabase.auth.signOut()} className="mt-1 flex items-center gap-1.5 text-xs font-medium text-ink-400 hover:text-ink-0">
            <LogOut className="h-3.5 w-3.5" /> Çıkış yap
          </button>
        </div>
      </div>
    </nav>
  );
}

// Mobil alt menü
export function BottomNav({ route }: { route: Route }) {
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {ITEMS.map(item => {
        const active = item.route.name === route.name;
        return (
          <a key={item.label} href={href(item.route)} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? 'text-debit-600' : 'text-slate-500'}`}>
            <item.icon className="h-5 w-5" />
            {item.short}
          </a>
        );
      })}
    </nav>
  );
}

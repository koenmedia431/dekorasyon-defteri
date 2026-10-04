import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, ATTACHMENT_BUCKET, type BusinessSettings } from './supabase';

export const EMPTY_SETTINGS: BusinessSettings = {
  name: '',
  phone: null,
  email: null,
  address: null,
  tax_office: null,
  tax_no: null,
  iban: null,
  bank_name: null,
  logo_path: null,
  statement_note: null,
};

interface SettingsCtx {
  settings: BusinessSettings;
  logoUrl: string | null;
  loaded: boolean;
  reload: () => Promise<void>;
}

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BusinessSettings>(EMPTY_SETTINGS);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const { data } = await supabase.from('business_settings').select('*').maybeSingle();
    const s = (data as BusinessSettings | null) ?? EMPTY_SETTINGS;
    // Eski sürümde firma adı tarayıcıda tutuluyordu; ayarlar boşsa onu kullan
    if (!s.name) {
      try {
        s.name = localStorage.getItem('defter.businessName') ?? '';
      } catch {
        /* depolama kapalı */
      }
    }
    setSettings(s);
    if (s.logo_path) {
      const { data: signed } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(s.logo_path, 60 * 60 * 12);
      setLogoUrl(signed?.signedUrl ?? null);
    } else setLogoUrl(null);
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return <Ctx.Provider value={{ settings, logoUrl, loaded, reload }}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const c = useContext(Ctx);
  if (!c) throw new Error('SettingsProvider eksik');
  return c;
}

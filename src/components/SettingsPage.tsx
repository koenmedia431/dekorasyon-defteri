import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Building2, Loader2, Upload, Trash2, Sun, Moon, Monitor, LogOut } from 'lucide-react';
import { supabase, ATTACHMENT_BUCKET, type BusinessSettings } from '@/lib/supabase';
import { useSettings, EMPTY_SETTINGS } from '@/lib/settings';
import { useTheme, type ThemePref } from '@/lib/theme';
import { inputClass, labelClass } from './Modal';
import { useToast } from './ui';

type Form = Record<Exclude<keyof BusinessSettings, 'user_id' | 'logo_path'>, string>;

const toForm = (s: BusinessSettings): Form => ({
  name: s.name ?? '',
  phone: s.phone ?? '',
  email: s.email ?? '',
  address: s.address ?? '',
  tax_office: s.tax_office ?? '',
  tax_no: s.tax_no ?? '',
  iban: s.iban ?? '',
  bank_name: s.bank_name ?? '',
  statement_note: s.statement_note ?? '',
});

export default function SettingsPage() {
  const { settings, logoUrl, reload } = useSettings();
  const [form, setForm] = useState<Form>(toForm(EMPTY_SETTINGS));
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [pref, setPref] = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => setForm(toForm(settings)), [settings]);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''));
  }, []);

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function save(e: FormEvent) {
    e.preventDefault();
    const iban = form.iban.replace(/\s/g, '').toUpperCase();
    if (iban && !/^TR\d{24}$/.test(iban)) return toast.error('IBAN "TR" ile başlayan 26 karakter olmalı');
    setBusy(true);
    const row = Object.fromEntries(Object.entries({ ...form, iban }).map(([k, v]) => [k, k === 'name' ? v.trim() : v.trim() || null]));
    const { error } = await supabase.from('business_settings').upsert({ ...row, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return toast.error('Kaydedilemedi: ' + error.message);
    await reload();
    toast.success('Firma bilgileri kaydedildi');
  }

  async function uploadLogo(file: File) {
    if (!file.type.startsWith('image/')) return toast.error('Logo bir görsel olmalı (PNG, JPG)');
    if (file.size > 2 * 1024 * 1024) return toast.error('Logo en fazla 2 MB olabilir');
    setLogoBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${u.user?.id}/branding/logo-${Date.now()}.${ext}`;
    const up = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file, { contentType: file.type });
    if (up.error) {
      setLogoBusy(false);
      return toast.error('Logo yüklenemedi: ' + up.error.message);
    }
    const old = settings.logo_path;
    const { error } = await supabase.from('business_settings').upsert({ name: form.name.trim(), logo_path: path, updated_at: new Date().toISOString() });
    if (!error && old) await supabase.storage.from(ATTACHMENT_BUCKET).remove([old]);
    setLogoBusy(false);
    if (error) return toast.error('Kaydedilemedi: ' + error.message);
    await reload();
    toast.success('Logo güncellendi');
  }

  async function removeLogo() {
    if (!settings.logo_path) return;
    setLogoBusy(true);
    await supabase.from('business_settings').update({ logo_path: null }).eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '');
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([settings.logo_path]);
    setLogoBusy(false);
    await reload();
    toast.success('Logo kaldırıldı');
  }

  const themeOptions: { k: ThemePref; label: string; icon: typeof Sun }[] = [
    { k: 'light', label: 'Açık', icon: Sun },
    { k: 'dark', label: 'Koyu', icon: Moon },
    { k: 'system', label: 'Sistem', icon: Monitor },
  ];

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-8">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Ayarlar</h1>
          <p className="text-sm text-slate-500">Firma bilgileriniz ekstrelerin antetinde ve WhatsApp mesajlarında kullanılır.</p>
        </div>

        <section className="rounded-xl bg-white p-5 shadow-card ring-1 ring-slate-200">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Building2 className="h-4 w-4 text-slate-500" /> Firma bilgileri
          </h2>

          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
              {logoUrl ? <img src={logoUrl} alt="Logo" className="h-full w-full bg-white object-contain p-1" /> : <Building2 className="h-7 w-7 text-slate-400" />}
            </div>
            <div className="flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={logoBusy}
                className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-60"
              >
                {logoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Logo yükle
              </button>
              {settings.logo_path && (
                <button type="button" onClick={removeLogo} disabled={logoBusy} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" /> Kaldır
                </button>
              )}
            </div>
          </div>

          <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Firma adı</label>
              <input className={inputClass} value={form.name} onChange={set('name')} placeholder="Yıldız Dekorasyon ve İnşaat Ltd. Şti." />
            </div>
            <div>
              <label className={labelClass}>Telefon</label>
              <input className={inputClass} type="tel" value={form.phone} onChange={set('phone')} placeholder="0532 000 00 00" />
            </div>
            <div>
              <label className={labelClass}>E-posta</label>
              <input className={inputClass} type="email" value={form.email} onChange={set('email')} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Adres</label>
              <textarea className={inputClass} rows={2} value={form.address} onChange={set('address')} />
            </div>
            <div>
              <label className={labelClass}>Vergi dairesi</label>
              <input className={inputClass} value={form.tax_office} onChange={set('tax_office')} placeholder="Kadıköy" />
            </div>
            <div>
              <label className={labelClass}>Vergi no / TCKN</label>
              <input className={inputClass} inputMode="numeric" value={form.tax_no} onChange={set('tax_no')} />
            </div>
            <div>
              <label className={labelClass}>IBAN</label>
              <input className={`${inputClass} tabular uppercase`} value={form.iban} onChange={set('iban')} placeholder="TR00 0000 0000 0000 0000 0000 00" />
            </div>
            <div>
              <label className={labelClass}>Banka</label>
              <input className={inputClass} value={form.bank_name} onChange={set('bank_name')} placeholder="Ziraat Bankası" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Ekstre alt notu (isteğe bağlı)</label>
              <textarea
                className={inputClass}
                rows={2}
                value={form.statement_note}
                onChange={set('statement_note')}
                placeholder="Ödemelerinizi açıklamaya proje adını yazarak yapmanızı rica ederiz."
              />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Kaydet
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-card ring-1 ring-slate-200">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Görünüm</h2>
          <div className="grid max-w-sm grid-cols-3 gap-2">
            {themeOptions.map(o => (
              <button
                key={o.k}
                onClick={() => setPref(o.k)}
                className={`flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-xs font-medium ring-1 ring-inset ${
                  pref === o.k ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                <o.icon className="h-5 w-5" />
                {o.label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-card ring-1 ring-slate-200">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Hesap</h2>
          <p className="text-sm text-slate-500">{email}</p>
          <button onClick={() => supabase.auth.signOut()} className="mt-3 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50">
            <LogOut className="h-4 w-4" /> Çıkış yap
          </button>
        </section>
      </div>
    </div>
  );
}

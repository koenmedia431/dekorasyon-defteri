import { useState, type FormEvent } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setMessage({
          type: 'error',
          text:
            error.code === 'invalid_credentials'
              ? 'E-posta veya şifre hatalı'
              : error.code === 'email_not_confirmed'
                ? 'E-posta adresiniz doğrulanmamış. Gelen kutunuzdaki bağlantıya tıklayın.'
                : error.message,
        });
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.href },
      });
      if (error) setMessage({ type: 'error', text: error.code === 'user_already_exists' ? 'Bu e-posta zaten kayıtlı' : error.message });
      else if (!data.session) setMessage({ type: 'info', text: 'Hesap oluşturuldu. E-postanıza gelen bağlantıyla doğrulayıp giriş yapın.' });
    }
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 rounded-2xl bg-sky-100 p-3">
            <BookOpen className="h-8 w-8 text-sky-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Müşteri Defteri</h1>
          <p className="mt-1 text-sm text-slate-500">Cari hesap, masraf ve ekstre takibi</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="E-posta"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="Şifre (en az 6 karakter)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
          {message && (
            <p className={`rounded-lg px-3 py-2 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-sky-50 text-sky-700'}`}>
              {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setMessage(null);
          }}
          className="mt-4 w-full text-center text-sm text-slate-500 hover:text-sky-600"
        >
          {mode === 'login' ? 'Hesabınız yok mu? Kayıt olun' : 'Zaten hesabınız var mı? Giriş yapın'}
        </button>
      </div>
    </div>
  );
}

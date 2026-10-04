import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, FileText } from 'lucide-react';
import { supabase, ATTACHMENT_BUCKET } from '@/lib/supabase';
import { extractText } from '@/lib/extract';
import { parseDocument, parseAmountInput, KIND_LABELS, formatMoney, type EntryKind, type ParsedDocument } from '@/lib/accounting';
import Modal, { inputClass, labelClass } from './Modal';

interface Props {
  customerId: string;
  file: File;
  onClose: () => void;
  onSaved: () => void;
}

const KIND_STYLE: Record<EntryKind, string> = {
  debit: 'bg-rose-600 border-rose-600',
  credit: 'bg-emerald-600 border-emerald-600',
  expense: 'bg-amber-500 border-amber-500',
};

// Dosya adını depolama için güvenli hâle getir
function safeName(name: string) {
  return name.normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(-80);
}

export default function DocumentImport({ customerId, file, onClose, onSaved }: Props) {
  const [stage, setStage] = useState('Dosya okunuyor…');
  const [ratio, setRatio] = useState<number | undefined>();
  const [text, setText] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedDocument | null>(null);
  const [kind, setKind] = useState<EntryKind>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [saveEntry, setSaveEntry] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview] = useState(() => (file.type.startsWith('image/') ? URL.createObjectURL(file) : null));

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    let cancelled = false;
    extractText(file, (s, r) => {
      if (cancelled) return;
      setStage(s);
      setRatio(r);
    })
      .then(t => {
        if (cancelled) return;
        const p = parseDocument(t);
        setText(t);
        setParsed(p);
        setKind(p.kind);
        setAmount(p.amount ? p.amount.toFixed(2).replace('.', ',') : '');
        setDate(p.date);
        setDescription(p.description);
        setSaveEntry(p.amount > 0);
      })
      .catch(e => {
        if (cancelled) return;
        console.error(e);
        setText('');
        setError('Dosya okunamadı. Bilgileri elle girebilirsiniz.');
        setDate(new Date().toISOString().slice(0, 10));
        setDescription(file.name);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = parseAmountInput(amount);
    if (saveEntry && !(value > 0)) return setError('Geçerli bir tutar girin');
    setBusy(true);
    setError('');

    // 1) Dosyayı yükle
    const { data: userData } = await supabase.auth.getUser();
    const path = `${userData.user?.id}/${customerId}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const up = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file, { contentType: file.type || undefined });
    if (up.error) {
      setBusy(false);
      return setError('Dosya yüklenemedi: ' + up.error.message);
    }

    // 2) Not + kayıt (tek işlem), sonra dosyayı nota bağla
    const desc = description.trim() || KIND_LABELS[kind];
    const entries = saveEntry ? [{ kind, amount: Math.round(value * 100) / 100, description: desc, date }] : [];
    const content = `📎 ${file.name}${saveEntry ? `\n${desc} · ${formatMoney(value)}` : ''}`;
    const rpc = await supabase.rpc('add_note_with_entries', { p_customer_id: customerId, p_content: content, p_entries: entries });
    if (rpc.error) {
      await supabase.storage.from(ATTACHMENT_BUCKET).remove([path]);
      setBusy(false);
      return setError('Kaydedilemedi: ' + rpc.error.message);
    }
    await supabase.from('notes').update({ attachment_path: path, attachment_name: file.name }).eq('id', rpc.data as string);
    setBusy(false);
    onSaved();
  }

  const loading = text === null;

  return (
    <Modal title="Belgeden Kayıt" onClose={busy ? () => {} : onClose}>
      <div className="mb-3 flex items-center gap-3 rounded-lg bg-slate-50 p-2">
        {preview ? (
          <img src={preview} alt="" className="h-16 w-16 rounded object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded bg-slate-200">
            <FileText className="h-7 w-7 text-slate-500" />
          </div>
        )}
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium text-slate-700">{file.name}</p>
          <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center">
          <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-sky-600" />
          <p className="text-sm text-slate-600">{stage}</p>
          {ratio !== undefined && (
            <div className="mx-auto mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-sky-500 transition-all" style={{ width: `${Math.round(ratio * 100)}%` }} />
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {parsed && (
            <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
              {parsed.docType === 'Belge' ? 'Belge türü anlaşılamadı' : `${parsed.docType} olarak anlaşıldı`}
              {parsed.amount ? `, toplam ${formatMoney(parsed.amount)} bulundu.` : ', toplam tutar bulunamadı.'} Kontrol edip kaydedin.
            </p>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={saveEntry} onChange={e => setSaveEntry(e.target.checked)} className="h-4 w-4" />
            Hesaba kayıt olarak ekle
          </label>

          {saveEntry && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {(['debit', 'credit', 'expense'] as EntryKind[]).map(k => (
                  <button
                    type="button"
                    key={k}
                    onClick={() => setKind(k)}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold ${
                      kind === k ? `${KIND_STYLE[k]} text-white` : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {KIND_LABELS[k]}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Tutar (₺)</label>
                  <input className={inputClass} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" />
                </div>
                <div>
                  <label className={labelClass}>Tarih</label>
                  <input className={inputClass} type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
              </div>
              {parsed && parsed.candidates.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-500">Diğer tutarlar:</span>
                  {parsed.candidates.slice(0, 6).map(c => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setAmount(c.toFixed(2).replace('.', ','))}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-sky-100"
                    >
                      {formatMoney(c, false)}
                    </button>
                  ))}
                </div>
              )}
              <div>
                <label className={labelClass}>Açıklama</label>
                <input className={inputClass} value={description} onChange={e => setDescription(e.target.value)} />
              </div>
            </>
          )}

          {text && (
            <details className="rounded-lg border border-slate-200 text-xs">
              <summary className="cursor-pointer px-3 py-2 text-slate-500">Okunan metni göster</summary>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap px-3 pb-3 font-sans text-slate-600">{text}</pre>
            </details>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {saveEntry ? 'Kaydet' : 'Sadece dosyayı sakla'}
          </button>
        </form>
      )}
    </Modal>
  );
}

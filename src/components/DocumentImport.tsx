import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Loader2, FileText, ListChecks, Square } from 'lucide-react';
import { supabase, ATTACHMENT_BUCKET } from '@/lib/supabase';
import { extractText } from '@/lib/extract';
import {
  parseDocument,
  parseDocumentItems,
  parseAmountInput,
  KIND_LABELS,
  formatMoney,
  type EntryKind,
  type ParsedDocument,
} from '@/lib/accounting';
import Modal, { inputClass, labelClass } from './Modal';

interface Props {
  customerId: string;
  file: File;
  onClose: () => void;
  onSaved: () => void;
}

interface Row {
  selected: boolean;
  kind: EntryKind;
  amount: string;
  date: string;
  description: string;
  line?: string;
}

const KIND_STYLE: Record<EntryKind, string> = {
  debit: 'bg-rose-600 border-rose-600',
  credit: 'bg-emerald-600 border-emerald-600',
  expense: 'bg-amber-500 border-amber-500',
};

const KIND_TEXT: Record<EntryKind, string> = {
  debit: 'text-rose-600',
  credit: 'text-emerald-600',
  expense: 'text-amber-600',
};

const KINDS: EntryKind[] = ['debit', 'credit', 'expense'];
const money = (n: number) => n.toFixed(2).replace('.', ',');

// Dosya adını depolama için güvenli hâle getir
function safeName(name: string) {
  return name.normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(-80);
}

export default function DocumentImport({ customerId, file, onClose, onSaved }: Props) {
  const [stage, setStage] = useState('Dosya okunuyor…');
  const [ratio, setRatio] = useState<number | undefined>();
  const [text, setText] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedDocument | null>(null);
  const [mode, setMode] = useState<'items' | 'single' | 'none'>('single');
  const [items, setItems] = useState<Row[]>([]);
  const [single, setSingle] = useState<Row>({ selected: true, kind: 'expense', amount: '', date: '', description: '' });
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
        const its = parseDocumentItems(t);
        setText(t);
        setParsed(p);
        setSingle({ selected: true, kind: p.kind, amount: p.amount ? money(p.amount) : '', date: p.date, description: p.description });
        setItems(its.map(i => ({ selected: true, kind: i.kind, amount: money(i.amount), date: i.date, description: i.description, line: i.line })));
        // Birden fazla kalem varsa kalem kalem işle
        setMode(its.length >= 2 ? 'items' : p.amount ? 'single' : its.length === 1 ? 'items' : 'none');
      })
      .catch(e => {
        if (cancelled) return;
        console.error(e);
        setText('');
        setError('Dosya okunamadı. Bilgileri elle girebilirsiniz.');
        setSingle(s => ({ ...s, date: new Date().toISOString().slice(0, 10), description: file.name }));
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const updateItem = (i: number, patch: Partial<Row>) => setItems(rows => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const activeRows = mode === 'items' ? items.filter(r => r.selected) : mode === 'single' ? [single] : [];
  const totals = useMemo(() => {
    const t: Record<EntryKind, number> = { debit: 0, credit: 0, expense: 0 };
    activeRows.forEach(r => {
      const v = parseAmountInput(r.amount);
      if (v > 0) t[r.kind] += v;
    });
    return t;
  }, [activeRows]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const entries = [];
    for (const r of activeRows) {
      const value = parseAmountInput(r.amount);
      if (!(value > 0)) return setError(`Geçerli bir tutar girin: "${r.description || 'kalem'}"`);
      if (!r.date) return setError(`Tarih eksik: "${r.description || 'kalem'}"`);
      entries.push({ kind: r.kind, amount: Math.round(value * 100) / 100, description: r.description.trim() || KIND_LABELS[r.kind], date: r.date });
    }
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

    // 2) Not + tüm kayıtlar (tek işlem), sonra dosyayı nota bağla
    const summary =
      entries.length === 0
        ? ''
        : entries.length === 1
          ? `\n${entries[0].description} · ${formatMoney(entries[0].amount)}`
          : `\n${entries.length} kalem: ${KINDS.filter(k => totals[k] > 0).map(k => `${KIND_LABELS[k]} ${formatMoney(totals[k])}`).join(', ')}`;
    const rpc = await supabase.rpc('add_note_with_entries', { p_customer_id: customerId, p_content: `📎 ${file.name}${summary}`, p_entries: entries });
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
  const selectedCount = items.filter(r => r.selected).length;

  return (
    <Modal title="Belgeden Kayıt" onClose={busy ? () => {} : onClose} wide={mode === 'items'}>
      <div className="mb-3 flex items-center gap-3 rounded-lg bg-slate-50 p-2">
        {preview ? (
          <img src={preview} alt="" className="h-14 w-14 rounded object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded bg-slate-200">
            <FileText className="h-6 w-6 text-slate-500" />
          </div>
        )}
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium text-slate-700">{file.name}</p>
          <p className="text-xs text-slate-500">
            {(file.size / 1024).toFixed(0)} KB{parsed && parsed.docType !== 'Belge' ? ` · ${parsed.docType}` : ''}
          </p>
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
          {/* Mod seçimi */}
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold">
            {[
              { k: 'items' as const, label: `Kalem kalem${items.length ? ` (${items.length})` : ''}`, disabled: items.length === 0 },
              { k: 'single' as const, label: 'Tek kayıt (toplam)', disabled: false },
              { k: 'none' as const, label: 'Sadece dosya', disabled: false },
            ].map(o => (
              <button
                type="button"
                key={o.k}
                disabled={o.disabled}
                onClick={() => setMode(o.k)}
                className={`rounded-md px-2 py-1.5 ${mode === o.k ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'} disabled:opacity-40`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {mode === 'items' && (
            <>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Her satır ayrı kayıt olur. Türü satır satır kontrol edin.</span>
                <button
                  type="button"
                  onClick={() => setItems(rows => rows.map(r => ({ ...r, selected: selectedCount !== rows.length })))}
                  className="flex items-center gap-1 font-medium text-sky-700"
                >
                  {selectedCount === items.length ? <Square className="h-3.5 w-3.5" /> : <ListChecks className="h-3.5 w-3.5" />}
                  {selectedCount === items.length ? 'Hiçbiri' : 'Tümü'}
                </button>
              </div>
              <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
                {items.map((r, i) => (
                  <div key={i} className={`rounded-lg border p-2 ${r.selected ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50 opacity-60'}`}>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={r.selected} onChange={e => updateItem(i, { selected: e.target.checked })} className="h-4 w-4 flex-shrink-0" />
                      <input
                        value={r.description}
                        onChange={e => updateItem(i, { description: e.target.value })}
                        className="min-w-0 flex-1 rounded border border-transparent px-1 py-0.5 text-sm font-medium text-slate-700 hover:border-slate-200 focus:border-sky-400 focus:outline-none"
                      />
                      <input
                        value={r.amount}
                        inputMode="decimal"
                        onChange={e => updateItem(i, { amount: e.target.value })}
                        className={`w-24 rounded border border-slate-200 px-1.5 py-0.5 text-right text-sm font-bold ${KIND_TEXT[r.kind]} focus:border-sky-400 focus:outline-none`}
                      />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-6">
                      {KINDS.map(k => (
                        <button
                          type="button"
                          key={k}
                          onClick={() => updateItem(i, { kind: k })}
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${r.kind === k ? `${KIND_STYLE[k]} text-white` : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        >
                          {KIND_LABELS[k]}
                        </button>
                      ))}
                      <input
                        type="date"
                        value={r.date}
                        onChange={e => updateItem(i, { date: e.target.value })}
                        className="ml-auto rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {mode === 'single' && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {KINDS.map(k => (
                  <button
                    type="button"
                    key={k}
                    onClick={() => setSingle({ ...single, kind: k })}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold ${single.kind === k ? `${KIND_STYLE[k]} text-white` : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {KIND_LABELS[k]}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Tutar (₺)</label>
                  <input className={inputClass} inputMode="decimal" value={single.amount} onChange={e => setSingle({ ...single, amount: e.target.value })} placeholder="0,00" />
                </div>
                <div>
                  <label className={labelClass}>Tarih</label>
                  <input className={inputClass} type="date" value={single.date} onChange={e => setSingle({ ...single, date: e.target.value })} />
                </div>
              </div>
              {parsed && parsed.candidates.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-500">Diğer tutarlar:</span>
                  {parsed.candidates.slice(0, 6).map(c => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setSingle({ ...single, amount: money(c) })}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-sky-100"
                    >
                      {formatMoney(c, false)}
                    </button>
                  ))}
                </div>
              )}
              <div>
                <label className={labelClass}>Açıklama</label>
                <input className={inputClass} value={single.description} onChange={e => setSingle({ ...single, description: e.target.value })} />
              </div>
            </>
          )}

          {mode === 'none' && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Dosya sohbete eklenir, hesaba kayıt yapılmaz.</p>}

          {activeRows.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {KINDS.filter(k => totals[k] > 0).map(k => (
                <span key={k} className={`rounded-lg bg-slate-50 px-2 py-1 font-semibold ${KIND_TEXT[k]}`}>
                  {KIND_LABELS[k]}: {formatMoney(totals[k])}
                </span>
              ))}
            </div>
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
            disabled={busy || (mode === 'items' && selectedCount === 0)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'items' ? `${selectedCount} kaydı ekle` : mode === 'single' ? 'Kaydet' : 'Dosyayı sakla'}
          </button>
        </form>
      )}
    </Modal>
  );
}

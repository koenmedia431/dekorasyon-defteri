import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Send, Loader2, Trash2, CheckCircle2, Bookmark, Paperclip, FileText } from 'lucide-react';
import { supabase, ATTACHMENT_BUCKET, type Note, type Transaction, type Expense, type Advance } from '@/lib/supabase';
import DocumentImport from './DocumentImport';
import { parseChatMessage, formatMoney, formatDate, KIND_LABELS, type EntryKind } from '@/lib/accounting';

interface Props {
  customerId: string;
  notes: Note[];
  transactions: Transaction[];
  expenses: Expense[];
  advances: Advance[];
  onChanged: () => void;
  onEditTx: (t: Transaction) => void;
  onEditExpense: (e: Expense) => void;
  onEditAdvance: (a: Advance) => void;
}

const KIND_COLOR: Record<EntryKind, string> = {
  debit: 'text-rose-600 bg-rose-50',
  credit: 'text-emerald-600 bg-emerald-50',
  expense: 'text-amber-600 bg-amber-50',
  advance: 'text-violet-600 bg-violet-50',
};

const EXAMPLES = [
  'Salon boya işçiliği 18.000 TL',
  'Ayşe hanım 10 bin kapora verdi',
  'Dün boya aldım 3.250, usta yevmiyesi 1500',
  'Cihad 5000 avans aldı',
  '15.09 mutfak tadilatı 40000',
];

function time(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ChatTab({ customerId, notes, transactions, expenses, advances, onChanged, onEditTx, onEditExpense, onEditAdvance }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [notes.length]);

  // Yazarken neyin anlaşıldığını göster
  const preview = useMemo(() => (text.trim() ? parseChatMessage(text) : []), [text]);

  async function send() {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError('');
    const entries = parseChatMessage(value).map(({ kind, amount, description, date, partner }) => ({ kind, amount, description, date, partner }));
    const { error: err } = await supabase.rpc('add_note_with_entries', {
      p_customer_id: customerId,
      p_content: value,
      p_entries: entries,
    });
    setSending(false);
    if (err) return setError('Kaydedilemedi: ' + err.message);
    setText('');
    onChanged();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  async function openAttachment(note: Note) {
    if (!note.attachment_path) return;
    // Pencereyi hemen aç (tarayıcı açılır pencere engeline takılmasın), adresi sonra ver
    const win = window.open('', '_blank');
    const { data, error: err } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(note.attachment_path, 300);
    if (err || !data) {
      win?.close();
      return alert('Dosya açılamadı');
    }
    if (win) win.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  }

  async function deleteNote(note: Note, linkedCount: number) {
    const withEntries = linkedCount > 0 && confirm('Bu mesajdan oluşan kayıtlar da silinsin mi?\n\nTamam: mesaj + kayıtlar\nİptal: sadece mesaj');
    if (!withEntries && !confirm('Mesaj silinsin mi?')) return;
    if (withEntries) {
      await supabase.from('transactions').delete().eq('note_id', note.id);
      await supabase.from('expenses').delete().eq('note_id', note.id);
      await supabase.from('advances').delete().eq('note_id', note.id);
    }
    await supabase.from('notes').delete().eq('id', note.id);
    if (note.attachment_path) await supabase.storage.from(ATTACHMENT_BUCKET).remove([note.attachment_path]);
    onChanged();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4 lg:p-6">
        {notes.length === 0 && (
          <div className="mx-auto max-w-md py-8 text-center">
            <h3 className="font-semibold text-slate-700">Ne olduğunu yazın, listeye ekleyeyim</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              İş / işçilik / fatura / tadilat → müşteri borcuna
              <br />
              Ödedi / kapora / havale / eft → tahsilata
              <br />
              Malzeme / boya aldım / usta / nakliye → masraf sayfanıza
              <br />
              Cihad / Mücahid / Emir + avans → ortak avansına
              <br />
              📎 ile fiş, fatura veya dekont fotoğrafı / PDF yükleyebilirsiniz.
              <br />
              "dün", "15.09", "3 eylül" gibi tarihleri de anlarım.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => setText(ex)} className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {notes.map(note => {
          const txs = transactions.filter(t => t.note_id === note.id);
          const exps = expenses.filter(e => e.note_id === note.id);
          const advs = advances.filter(a => a.note_id === note.id);
          const count = txs.length + exps.length + advs.length;
          return (
            <div key={note.id} className="space-y-1.5">
              <div className="group ml-auto flex max-w-[85%] items-start justify-end gap-1">
                <button
                  onClick={() => deleteNote(note, count)}
                  className="mt-2 rounded p-1 text-slate-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
                  title="Mesajı sil"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <div className="rounded-2xl rounded-br-sm bg-sky-600 px-4 py-2 text-white">
                  {note.attachment_path && (
                    <button
                      onClick={() => openAttachment(note)}
                      className="mb-1 flex items-center gap-1.5 rounded-lg bg-sky-700/60 px-2 py-1 text-xs font-medium hover:bg-sky-800"
                      title="Dosyayı aç"
                    >
                      <FileText className="h-3.5 w-3.5" /> {note.attachment_name ?? 'Dosya'}
                    </button>
                  )}
                  <p className="whitespace-pre-wrap text-sm">{note.attachment_path ? note.content.split('\n').slice(1).join('\n') || 'Dosya eklendi' : note.content}</p>
                  <p className="mt-1 text-right text-[10px] text-sky-100">{time(note.created_at)}</p>
                </div>
              </div>
              <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white p-2.5">
                {count === 0 ? (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Bookmark className="h-3.5 w-3.5" /> Tutar bulunamadı, not olarak kaydedildi.
                  </p>
                ) : (
                  <>
                    <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-sky-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {count} kayıt eklendi
                    </p>
                    {[
                      ...txs.map(t => ({ id: t.id, kind: t.entry_type as EntryKind, amount: t.amount, desc: t.description, date: t.entry_date, edit: () => onEditTx(t) })),
                      ...exps.map(e => ({ id: e.id, kind: 'expense' as EntryKind, amount: e.amount, desc: e.description, date: e.expense_date, edit: () => onEditExpense(e) })),
                      ...advs.map(a => ({ id: a.id, kind: 'advance' as EntryKind, amount: a.amount, desc: `${a.partner} · ${a.description}`, date: a.advance_date, edit: () => onEditAdvance(a) })),
                    ].map(r => (
                      <button key={r.id} onClick={r.edit} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-slate-50" title="Düzenle">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${KIND_COLOR[r.kind]}`}>{KIND_LABELS[r.kind]}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{r.desc}</span>
                        <span className="hidden text-[11px] text-slate-400 sm:inline">{formatDate(r.date)}</span>
                        <span className={`whitespace-nowrap text-sm font-bold ${KIND_COLOR[r.kind].split(' ')[0]}`}>{formatMoney(r.amount)}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="no-print border-t border-slate-200 bg-white p-3">
        {preview.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {preview.map((p, i) => (
              <span key={i} className={`rounded-lg px-2 py-1 text-xs font-medium ${KIND_COLOR[p.kind]}`}>
                {p.kind === 'advance' ? `${p.partner} avansı` : KIND_LABELS[p.kind]}
                {p.guessed ? '?' : ''} {formatMoney(p.amount)} · {p.description} · {formatDate(p.date)}
              </span>
            ))}
          </div>
        )}
        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) setImportFile(f);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-sky-600"
            title="Fiş, fatura veya dekont yükle (fotoğraf / PDF)"
            aria-label="Belge yükle"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Örn: Banyo işi 12.000 TL"
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-sky-500"
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40"
            aria-label="Gönder"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {importFile && (
        <DocumentImport
          customerId={customerId}
          file={importFile}
          onClose={() => setImportFile(null)}
          onSaved={() => {
            setImportFile(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

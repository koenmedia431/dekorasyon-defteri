import { useMemo, useState } from 'react';
import { Printer, Share2, Copy, Check, Settings } from 'lucide-react';
import type { CustomerWithBalance, Transaction } from '@/lib/supabase';
import { buildStatement, statementToText, formatMoney, formatDate, balanceLabel, toDateStr, todayStr } from '@/lib/accounting';
import { useSettings } from '@/lib/settings';
import { href } from '@/lib/router';
import { useToast } from './ui';

type Period = 'all' | 'thisMonth' | 'lastMonth' | 'last3' | 'custom';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'thisMonth', label: 'Bu Ay' },
  { key: 'lastMonth', label: 'Geçen Ay' },
  { key: 'last3', label: 'Son 3 Ay' },
  { key: 'custom', label: 'Tarih Seç' },
];

function range(p: Period, from: string, to: string): { from?: string; to?: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (p) {
    case 'thisMonth':
      return { from: toDateStr(new Date(y, m, 1)), to: todayStr() };
    case 'lastMonth':
      return { from: toDateStr(new Date(y, m - 1, 1)), to: toDateStr(new Date(y, m, 0)) };
    case 'last3':
      return { from: toDateStr(new Date(y, m - 2, 1)), to: todayStr() };
    case 'custom':
      return { from: from || undefined, to: to || undefined };
    default:
      return {};
  }
}

// IBAN'ı 4'lü gruplar hâlinde yaz
const formatIban = (iban: string) => iban.replace(/\s/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();

// Müşteriye gönderilen ekstre: sadece iş/fatura ve tahsilatlar (masraf ve avanslar yok)
export default function StatementTab({ customer, transactions }: { customer: CustomerWithBalance; transactions: Transaction[] }) {
  const [period, setPeriod] = useState<Period>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [copied, setCopied] = useState(false);
  const { settings, logoUrl } = useSettings();
  const toast = useToast();

  const r = useMemo(() => range(period, customFrom, customTo), [period, customFrom, customTo]);
  const st = useMemo(() => buildStatement(transactions, r.from, r.to), [transactions, r]);

  const contract = Number(customer.contract_amount) || 0;
  const billedAll = transactions.filter(t => t.entry_type === 'debit').reduce((s, t) => s + t.amount, 0);
  const contractLines = contract
    ? [`Sözleşme bedeli: ${formatMoney(contract)}`, `Faturalanan: ${formatMoney(billedAll)} (%${Math.min(100, (billedAll / contract) * 100).toFixed(0)})`, `Kalan iş: ${formatMoney(Math.max(0, contract - billedAll))}`]
    : [];
  const footerLines = [
    settings.iban ? `Ödeme için IBAN: ${formatIban(settings.iban)}${settings.bank_name ? ` (${settings.bank_name})` : ''}` : '',
    settings.iban && settings.name ? `Alıcı: ${settings.name}` : '',
    settings.statement_note ?? '',
    settings.phone ? `İletişim: ${settings.phone}` : '',
  ].filter(Boolean);

  const text = statementToText(st, {
    customerName: customer.name,
    businessName: settings.name,
    from: r.from,
    to: r.to,
    extraLines: contractLines,
    footerLines,
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Kopyalanamadı');
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${customer.name} - Hesap Ekstresi`, text });
      } catch {
        /* kullanıcı iptal etti */
      }
      return;
    }
    // Paylaşım menüsü yoksa WhatsApp'ı aç (telefon kayıtlıysa doğrudan müşteriye)
    const phone = (customer.phone ?? '').replace(/\D/g, '').replace(/^0/, '90');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  }

  const hasLetterhead = !!(settings.name || settings.address || settings.iban);

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6 print:overflow-visible print:p-0">
      <div className="no-print mb-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${period === p.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-900" />
            <span className="text-slate-400">–</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-900" />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button onClick={share} className="flex items-center gap-1.5 rounded-lg bg-credit-600 px-3 py-2 text-sm font-semibold text-white hover:bg-credit-700">
            <Share2 className="h-4 w-4" /> Gönder (WhatsApp vb.)
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            <Printer className="h-4 w-4" /> Yazdır / PDF
          </button>
          <button onClick={copy} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50">
            {copied ? <Check className="h-4 w-4 text-credit-600" /> : <Copy className="h-4 w-4" />} {copied ? 'Kopyalandı' : 'Metni Kopyala'}
          </button>
        </div>
        {!hasLetterhead && (
          <a href={href({ name: 'settings' })} className="flex items-center gap-2 rounded-lg bg-debit-50 px-3 py-2 text-xs text-debit-800 ring-1 ring-inset ring-debit-100">
            <Settings className="h-3.5 w-3.5" /> Ekstrede firma adınız, logonuz ve IBAN'ınız görünsün: Ayarlar → Firma bilgileri
          </a>
        )}
      </div>

      {/* Yazdırılabilir, antetli ekstre */}
      <article className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow-card ring-1 ring-slate-200 sm:p-8 print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0">
        <header className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
          <div className="flex items-start gap-3">
            {logoUrl && <img src={logoUrl} alt="" className="h-14 w-14 object-contain" />}
            <div className="text-xs leading-5 text-slate-600">
              {settings.name && <p className="text-base font-bold text-slate-900">{settings.name}</p>}
              {settings.address && <p className="whitespace-pre-line">{settings.address}</p>}
              <p>{[settings.phone, settings.email].filter(Boolean).join(' · ')}</p>
              {(settings.tax_office || settings.tax_no) && <p>{[settings.tax_office && `${settings.tax_office} V.D.`, settings.tax_no && `VKN/TCKN ${settings.tax_no}`].filter(Boolean).join(' · ')}</p>}
            </div>
          </div>
          <div className="text-right">
            <h3 className="text-lg font-bold uppercase tracking-wide text-slate-900">Hesap Ekstresi</h3>
            <p className="text-xs text-slate-500">Düzenleme: {formatDate(todayStr())}</p>
            <p className="text-xs text-slate-500">{r.from ? `${formatDate(r.from)} – ${formatDate(r.to || todayStr())}` : 'Tüm hareketler'}</p>
          </div>
        </header>

        <section className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sayın</p>
            <p className="font-semibold text-slate-900">{customer.name}</p>
            {customer.address && <p className="text-xs text-slate-600">{customer.address}</p>}
            {customer.phone && <p className="text-xs text-slate-600">{customer.phone}</p>}
          </div>
          {(customer.project_title || contract > 0) && (
            <div className="sm:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Proje</p>
              {customer.project_title && <p className="font-semibold text-slate-900">{customer.project_title}</p>}
              {contract > 0 && (
                <p className="tabular text-xs text-slate-600">
                  Sözleşme {formatMoney(contract)} · Kalan iş {formatMoney(Math.max(0, contract - billedAll))}
                </p>
              )}
            </div>
          )}
        </section>

        <table className="tabular mt-5 w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-300">
              <th className="py-2 text-left font-semibold">Tarih</th>
              <th className="py-2 text-left font-semibold">Açıklama</th>
              <th className="py-2 text-right font-semibold">Borç</th>
              <th className="py-2 text-right font-semibold">Ödeme</th>
              <th className="py-2 text-right font-semibold">Bakiye</th>
            </tr>
          </thead>
          <tbody>
            {r.from && (
              <tr className="border-b border-slate-100 text-slate-500">
                <td className="py-2" colSpan={4}>
                  Devreden bakiye
                </td>
                <td className="py-2 text-right">{formatMoney(st.opening)}</td>
              </tr>
            )}
            {st.rows.map(({ entry, balance }) => (
              <tr key={entry.id} className="border-b border-slate-100">
                <td className="whitespace-nowrap py-2 pr-2 text-slate-500">{formatDate(entry.entry_date)}</td>
                <td className="py-2 pr-2 text-slate-800">{entry.description}</td>
                <td className="whitespace-nowrap py-2 text-right text-slate-800">{entry.entry_type === 'debit' ? formatMoney(entry.amount) : ''}</td>
                <td className="whitespace-nowrap py-2 text-right text-slate-800">{entry.entry_type === 'credit' ? formatMoney(entry.amount) : ''}</td>
                <td className="whitespace-nowrap py-2 text-right font-medium text-slate-900">{formatMoney(balance)}</td>
              </tr>
            ))}
            {st.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  Bu dönemde hareket yok.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-300">
              <td colSpan={2} className="pt-3 font-semibold text-slate-700">
                Toplam
              </td>
              <td className="whitespace-nowrap pt-3 text-right font-semibold text-slate-900">{formatMoney(st.totalDebit)}</td>
              <td className="whitespace-nowrap pt-3 text-right font-semibold text-slate-900">{formatMoney(st.totalCredit)}</td>
              <td />
            </tr>
          </tfoot>
        </table>

        <div className="mt-5 flex items-center justify-between rounded-lg bg-slate-100 px-4 py-3">
          <span className="font-semibold text-slate-700">Güncel Bakiye</span>
          <span className="tabular text-lg font-bold text-slate-900">
            {formatMoney(Math.abs(st.closing))} <span className="text-sm font-medium text-slate-500">({balanceLabel(st.closing)})</span>
          </span>
        </div>

        {footerLines.length > 0 && (
          <footer className="mt-6 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-600">
            {settings.iban && (
              <p>
                <span className="font-semibold text-slate-800">Ödeme bilgileri:</span> {formatIban(settings.iban)}
                {settings.bank_name ? ` · ${settings.bank_name}` : ''}
                {settings.name ? ` · Alıcı: ${settings.name}` : ''}
              </p>
            )}
            {settings.statement_note && <p className="mt-1 whitespace-pre-line">{settings.statement_note}</p>}
          </footer>
        )}
      </article>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Printer, Share2, Copy, Check } from 'lucide-react';
import type { Customer, Transaction } from '@/lib/supabase';
import { buildStatement, statementToText, formatMoney, formatDate, balanceLabel, toDateStr, todayStr } from '@/lib/accounting';

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

const BUSINESS_KEY = 'defter.businessName';

function readBusinessName(): string {
  try {
    return localStorage.getItem(BUSINESS_KEY) ?? '';
  } catch {
    return '';
  }
}

// Müşteriye gönderilen ekstre: sadece iş/fatura ve tahsilatlar (masraflar yok)
export default function StatementTab({ customer, transactions }: { customer: Customer; transactions: Transaction[] }) {
  const [period, setPeriod] = useState<Period>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [businessName, setBusinessName] = useState(readBusinessName);
  const [copied, setCopied] = useState(false);

  const r = useMemo(() => range(period, customFrom, customTo), [period, customFrom, customTo]);
  const st = useMemo(() => buildStatement(transactions, r.from, r.to), [transactions, r]);
  const text = statementToText(st, { customerName: customer.name, businessName, from: r.from, to: r.to });

  function saveBusinessName(v: string) {
    setBusinessName(v);
    try {
      localStorage.setItem(BUSINESS_KEY, v);
    } catch {
      /* depolama kapalıysa sadece bu oturumda kalır */
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('Kopyalanamadı');
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${customer.name} - Hesap Ekstresi`, text });
        return;
      } catch {
        /* kullanıcı iptal etti */
        return;
      }
    }
    // Paylaşım menüsü yoksa WhatsApp'ı aç (telefon kayıtlıysa doğrudan müşteriye)
    const phone = (customer.phone ?? '').replace(/\D/g, '').replace(/^0/, '90');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  }

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6 print:overflow-visible print:p-0">
      <div className="no-print mb-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                period === p.key ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5" />
            <span className="text-slate-400">–</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5" />
          </div>
        )}
        <input
          value={businessName}
          onChange={e => saveBusinessName(e.target.value)}
          placeholder="Firma adınız (ekstrenin başında görünür)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 sm:max-w-sm"
        />
        <div className="flex flex-wrap gap-2">
          <button onClick={share} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            <Share2 className="h-4 w-4" /> Gönder (WhatsApp vb.)
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            <Printer className="h-4 w-4" /> Yazdır / PDF
          </button>
          <button onClick={copy} className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied ? 'Kopyalandı' : 'Metni Kopyala'}
          </button>
        </div>
      </div>

      {/* Yazdırılabilir ekstre */}
      <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 print:max-w-none print:border-0 print:p-0">
        <div className="mb-4 flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            {businessName && <p className="text-sm font-semibold text-slate-500">{businessName}</p>}
            <h3 className="text-xl font-bold text-slate-800">Hesap Ekstresi</h3>
            <p className="mt-1 text-sm text-slate-600">Sayın {customer.name}</p>
            {customer.address && <p className="text-xs text-slate-500">{customer.address}</p>}
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Düzenleme: {formatDate(todayStr())}</p>
            <p>{r.from ? `${formatDate(r.from)} – ${formatDate(r.to || todayStr())}` : 'Tüm hareketler'}</p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500">
            <tr className="border-b border-slate-200">
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
                <td className="py-2" colSpan={4}>Devreden bakiye</td>
                <td className="py-2 text-right">{formatMoney(st.opening)}</td>
              </tr>
            )}
            {st.rows.map(({ entry, balance }) => (
              <tr key={entry.id} className="border-b border-slate-100">
                <td className="whitespace-nowrap py-2 pr-2 text-slate-500">{formatDate(entry.entry_date)}</td>
                <td className="py-2 pr-2 text-slate-700">{entry.description}</td>
                <td className="whitespace-nowrap py-2 text-right">{entry.entry_type === 'debit' ? formatMoney(entry.amount) : ''}</td>
                <td className="whitespace-nowrap py-2 text-right">{entry.entry_type === 'credit' ? formatMoney(entry.amount) : ''}</td>
                <td className="whitespace-nowrap py-2 text-right font-medium">{formatMoney(balance)}</td>
              </tr>
            ))}
            {st.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">Bu dönemde hareket yok.</td>
              </tr>
            )}
          </tbody>
          <tfoot className="text-sm">
            <tr>
              <td colSpan={2} className="pt-3 font-semibold text-slate-600">Toplam</td>
              <td className="whitespace-nowrap pt-3 text-right font-semibold">{formatMoney(st.totalDebit)}</td>
              <td className="whitespace-nowrap pt-3 text-right font-semibold">{formatMoney(st.totalCredit)}</td>
              <td />
            </tr>
          </tfoot>
        </table>

        <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
          <span className="font-semibold text-slate-700">Güncel Bakiye</span>
          <span className="text-lg font-bold text-slate-900">
            {formatMoney(Math.abs(st.closing))} <span className="text-sm font-medium text-slate-500">({balanceLabel(st.closing)})</span>
          </span>
        </div>
      </div>
    </div>
  );
}

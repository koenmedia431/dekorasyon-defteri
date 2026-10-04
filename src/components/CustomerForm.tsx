import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase, type Customer } from '@/lib/supabase';
import { parseAmountInput } from '@/lib/accounting';
import Modal, { inputClass, labelClass } from './Modal';
import { STATUS_LABELS, type ProjectStatus } from './ui';

interface Props {
  customer?: Customer; // varsa düzenleme
  onClose: () => void;
  onSaved: (id: string) => void;
}

export default function CustomerForm({ customer, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    notes: customer?.notes ?? '',
    project_title: customer?.project_title ?? '',
    contract_amount: customer?.contract_amount ? Number(customer.contract_amount).toFixed(2).replace('.', ',') : '',
    start_date: customer?.start_date ?? '',
    due_date: customer?.due_date ?? '',
  });
  const [status, setStatus] = useState<ProjectStatus>(customer?.status ?? 'active');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Müşteri adı zorunlu');
    const contract = form.contract_amount.trim() ? parseAmountInput(form.contract_amount) : null;
    if (contract !== null && !(contract >= 0)) return setError('Sözleşme bedelini kontrol edin');
    setBusy(true);
    const row = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      status,
      project_title: form.project_title.trim() || null,
      contract_amount: contract,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
    };
    const res = customer
      ? await supabase.from('customers').update(row).eq('id', customer.id).select('id').single()
      : await supabase.from('customers').insert(row).select('id').single();
    setBusy(false);
    if (res.error) return setError('Kaydedilemedi: ' + res.error.message);
    onSaved(res.data.id);
  }

  return (
    <Modal title={customer ? 'Müşteri / Proje Bilgileri' : 'Yeni Müşteri / Proje'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelClass}>Ad / Firma *</label>
          <input autoFocus className={inputClass} value={form.name} onChange={set('name')} placeholder="Ayşe Yılmaz veya ABC İnşaat Ltd." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Telefon</label>
            <input className={inputClass} type="tel" value={form.phone} onChange={set('phone')} placeholder="05xx xxx xx xx" />
          </div>
          <div>
            <label className={labelClass}>E-posta</label>
            <input className={inputClass} type="email" value={form.email} onChange={set('email')} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Şantiye / iş adresi</label>
          <input className={inputClass} value={form.address} onChange={set('address')} placeholder="Kadıköy, Moda Cad. No:12 D:5" />
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Proje</p>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Proje adı</label>
              <input className={inputClass} value={form.project_title} onChange={set('project_title')} placeholder="3+1 daire komple tadilat" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Sözleşme bedeli (₺)</label>
                <input className={inputClass} inputMode="decimal" value={form.contract_amount} onChange={set('contract_amount')} placeholder="0,00" />
              </div>
              <div>
                <label className={labelClass}>Başlangıç</label>
                <input className={inputClass} type="date" value={form.start_date} onChange={set('start_date')} />
              </div>
              <div>
                <label className={labelClass}>Teslim</label>
                <input className={inputClass} type="date" value={form.due_date} onChange={set('due_date')} />
              </div>
            </div>
          </div>
        </div>
        <div>
          <label className={labelClass}>Proje durumu</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map(s => (
              <button
                type="button"
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-lg border px-2 py-2 text-xs font-semibold ${status === s ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>Not</label>
          <textarea className={inputClass} rows={2} value={form.notes} onChange={set('notes')} />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Kaydet
        </button>
      </form>
    </Modal>
  );
}

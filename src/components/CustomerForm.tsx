import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase, type Customer } from '@/lib/supabase';
import Modal, { inputClass, labelClass } from './Modal';

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
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Müşteri adı zorunlu');
    setBusy(true);
    const row = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };
    const res = customer
      ? await supabase.from('customers').update(row).eq('id', customer.id).select('id').single()
      : await supabase.from('customers').insert(row).select('id').single();
    setBusy(false);
    if (res.error) return setError('Kaydedilemedi: ' + res.error.message);
    onSaved(res.data.id);
  }

  return (
    <Modal title={customer ? 'Müşteriyi Düzenle' : 'Yeni Müşteri'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelClass}>Ad / Firma *</label>
          <input autoFocus className={inputClass} value={form.name} onChange={set('name')} placeholder="Ayşe Yılmaz" />
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
          <label className={labelClass}>Adres / İş yeri</label>
          <input className={inputClass} value={form.address} onChange={set('address')} placeholder="Kadıköy, 3+1 daire" />
        </div>
        <div>
          <label className={labelClass}>Not</label>
          <textarea className={inputClass} rows={2} value={form.notes} onChange={set('notes')} />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Kaydet
        </button>
      </form>
    </Modal>
  );
}

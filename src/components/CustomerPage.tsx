import { useCallback, useEffect, useState } from 'react';
import { supabase, type CustomerWithBalance, type Transaction, type Expense, type Advance, type Note } from '@/lib/supabase';
import CustomerDetail from './CustomerDetail';

interface Props {
  customer: CustomerWithBalance;
  onCustomerChanged: () => void;
  onCustomerDeleted: () => void;
}

const num = <T extends { amount: number }>(rows: T[]) => rows.map(r => ({ ...r, amount: Number(r.amount) }));

// Seçili müşterinin tüm kayıtlarını yükler
export default function CustomerPage({ customer, onCustomerChanged, onCustomerDeleted }: Props) {
  const [data, setData] = useState<{ transactions: Transaction[]; expenses: Expense[]; advances: Advance[]; notes: Note[] } | null>(null);

  const load = useCallback(async () => {
    const id = customer.id;
    const [tx, exp, adv, notes] = await Promise.all([
      supabase.from('transactions').select('*').eq('customer_id', id).order('entry_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').eq('customer_id', id).order('expense_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('advances').select('*').eq('customer_id', id).order('advance_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('notes').select('*').eq('customer_id', id).order('created_at', { ascending: true }),
    ]);
    setData({
      transactions: num((tx.data || []) as Transaction[]),
      expenses: num((exp.data || []) as Expense[]),
      advances: num((adv.data || []) as Advance[]),
      notes: (notes.data || []) as Note[],
    });
  }, [customer.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-debit-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <CustomerDetail
      customer={customer}
      {...data}
      onDataChanged={() => {
        load();
        onCustomerChanged();
      }}
      onCustomerUpdated={onCustomerChanged}
      onCustomerDeleted={onCustomerDeleted}
    />
  );
}

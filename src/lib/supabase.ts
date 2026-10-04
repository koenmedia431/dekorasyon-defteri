import { createClient } from '@supabase/supabase-js';

// Herkese açık (publishable) anahtar; veriler veritabanındaki RLS kurallarıyla korunur
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://vvydeobqoeegsqhebztv.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_zjuVCc4QO_b7NRSqhPcO1g_-FABVcYd';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export type EntryType = 'debit' | 'credit';

// debit: müşteriye yazılan iş/fatura (borç), credit: müşteriden alınan ödeme
export interface Transaction {
  id: string;
  customer_id: string;
  entry_type: EntryType;
  amount: number;
  description: string;
  entry_date: string;
  note_id: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  customer_id: string;
  amount: number;
  description: string;
  category: string | null;
  expense_date: string;
  note_id: string | null;
  created_at: string;
}

export interface Note {
  id: string;
  customer_id: string;
  content: string;
  attachment_path: string | null;
  attachment_name: string | null;
  created_at: string;
}

export const ATTACHMENT_BUCKET = 'attachments';

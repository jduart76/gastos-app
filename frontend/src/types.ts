export type Purchase = {
  id: number;

  purchase_date: string;
  description: string;
  store: string;

  amount_total: number;

  is_msi: boolean;
  msi_months: number | null;
  start_month: string;

  split_mode: "full" | "half" | "custom";
  split_juan_pct: number | null;
  split_kenia_pct: number | null;

  created_by: string;

  monthly_amount: number;
  paid: number;
  pending: number;
};

export type Payment = {
  id: number;
  purchase_id: number;
  payment_date: string;
  payer: string;
  amount: number;
  note?: string | null;
  split_50: boolean;
  created_at?: string;
};

export type Dashboard = {
  total_pending: number;
  total_due_this_month: number;
  total_due_next_month: number;
  next_month: string;
  open_count: number;
};

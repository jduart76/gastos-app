export type UserName = "Juan" | "Kenia";

export type Purchase = {
  id: number;
  purchase_date: string;
  description: string;
  store: string;
  amount_total: number;
  is_msi: boolean;
  msi_months: number | null;
  start_month: string;
  split_mode: "full" | "half";
  created_by: string;
  monthly_amount: number;
  paid: number;
  pending: number;
};

export type Payment = {
  id: number;
  payment_date: string;
  payer: string;
  amount: number;
  note?: string | null;
  split_50: boolean;
};

export type Dashboard = {
  month: string;
  next_month: string;
  total_pending: number;
  total_due_this_month: number;
  total_due_next_month: number;
  open_count: number;
};

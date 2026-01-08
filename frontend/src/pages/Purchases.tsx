import React from "react";
import { api } from "../api";
import type { Purchase } from "../types";
import { Table } from "../components/Table";
import { Modal } from "../components/Modal";
import { Segmented } from "../components/Segmented";
import { Loading } from "../components/Loading";

function clampPct(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function pctJuan(r: Purchase): number | null {
  if (r.split_mode === "custom") return r.split_juan_pct ?? 0;
  if (r.split_mode === "half") return 50;
  return null;
}

function pctKenia(r: Purchase): number | null {
  if (r.split_mode === "custom") return r.split_kenia_pct ?? 0;
  if (r.split_mode === "half") return 50;
  return null;
}

export function PurchasesPage(props: { onOpenPurchase: (id: number) => void }) {
  const [rows, setRows] = React.useState<Purchase[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const [form, setForm] = React.useState({
    purchase_date: new Date().toISOString().slice(0, 10),
    description: "",
    store: "",
    amount_total: "",

    is_msi: "false",
    msi_months: "",
    start_month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,

    split_mode: "full", // "full" | "custom"
    split_juan_pct: "50",
    split_kenia_pct: "50",
  });

  async function load() {
    try {
      setErr(null);
      setLoading(true);
      const res = await api.purchases();
      setRows(res);
    } catch (e: any) {
      setErr("No se pudieron cargar compras.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  async function create() {
    // validación split custom
    let splitJuan: number | null = null;
    let splitKenia: number | null = null;
    const splitModeToSend: "full" | "custom" = form.split_mode as any;

    if (splitModeToSend === "custom") {
      splitJuan = clampPct(Number(form.split_juan_pct || "0"));
      splitKenia = clampPct(Number(form.split_kenia_pct || "0"));
      if (splitJuan + splitKenia !== 100) {
        setErr("Los porcentajes deben sumar 100.");
        return;
      }
    }

    const payload: any = {
      purchase_date: form.purchase_date,
      description: form.description,
      store: form.store,
      amount_total: Number(form.amount_total),

      is_msi: form.is_msi === "true",
      msi_months: form.is_msi === "true" ? Number(form.msi_months || 0) : null,
      start_month: form.start_month,

      split_mode: splitModeToSend,
      split_juan_pct: splitModeToSend === "custom" ? splitJuan : null,
      split_kenia_pct: splitModeToSend === "custom" ? splitKenia : null,
    };

    try {
      setErr(null);
      setLoading(true);
      await api.createPurchase(payload);
      setOpen(false);
      setForm((f) => ({ ...f, description: "", store: "", amount_total: "", msi_months: "" }));
      await load();
    } catch (e: any) {
      setErr(String(e?.message ?? "No se pudo guardar la compra."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      <div className="actions">
        <button className="btn primary" onClick={() => setOpen(true)} disabled={loading}>
          ➕ Nueva compra
        </button>
        {loading ? <Loading inline label="Cargando…" /> : null}
        {err ? <span className="chip bad">{err}</span> : null}
      </div>

      {loading ? (
        <Loading label="Cargando compras…" />
      ) : (
        <Table
          rows={rows}
          cols={[
            { key: "purchase_date", label: "Fecha" },
            { key: "store", label: "Tienda" },
            { key: "description", label: "Descripción" },

            {
              key: "start_month",
              label: "Primer pago",
              mono: true,
              render: (r) => (r.is_msi ? r.start_month : "—"),
            },

            {
              key: "is_msi",
              label: "MSI",
              render: (r) => (r.is_msi ? <span className="chip ok">Sí</span> : <span className="chip">No</span>),
            },
            {
              key: "msi_months",
              label: "# MSI",
              mono: true,
              render: (r) => (r.is_msi ? String(r.msi_months ?? "") : "—"),
            },

            { key: "amount_total", label: "Total", mono: true, render: (r) => `$${r.amount_total.toFixed(2)}` },
            { key: "monthly_amount", label: "Mensual", mono: true, render: (r) => `$${r.monthly_amount.toFixed(2)}` },

            {
              key: "split_mode",
              label: "Juan",
              mono: true,
              render: (r) => {
                const pct = pctJuan(r);
                if (pct == null) return "—";
                const amt = (r.monthly_amount * pct) / 100;
                return `$${amt.toFixed(2)} (${pct}%)`;
              },
            },
            {
              key: "split_mode",
              label: "Kenia",
              mono: true,
              render: (r) => {
                const pct = pctKenia(r);
                if (pct == null) return "—";
                const amt = (r.monthly_amount * pct) / 100;
                return `$${amt.toFixed(2)} (${pct}%)`;
              },
            },

            {
              key: "pending",
              label: "Pendiente",
              mono: true,
              render: (r) =>
                r.pending <= 0.005 ? (
                  <span className="chip ok">Cerrada</span>
                ) : (
                  <span className="chip bad">${r.pending.toFixed(2)}</span>
                ),
            },
          ]}
          onRowClick={(r) => props.onOpenPurchase(r.id)}
        />
      )}

      <Modal open={open} title="Nueva compra" onClose={() => setOpen(false)}>
        <div className="row">
          <div className="field">
            <label htmlFor="p_purchase_date">Fecha</label>
            <input
              id="p_purchase_date"
              type="date"
              value={form.purchase_date}
              onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="p_start_month">Mes inicio (YYYY-MM)</label>
            <input
              id="p_start_month"
              value={form.start_month}
              onChange={(e) => setForm({ ...form, start_month: e.target.value })}
              placeholder="2026-01"
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="p_store">Tienda</label>
          <input
            id="p_store"
            value={form.store}
            onChange={(e) => setForm({ ...form, store: e.target.value })}
            placeholder="Costco, Amazon…"
          />
        </div>

        <div className="field">
          <label htmlFor="p_description">Descripción</label>
          <input
            id="p_description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Ej. despensa…"
          />
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor="p_amount_total">Monto total</label>
            <input
              id="p_amount_total"
              inputMode="decimal"
              value={form.amount_total}
              onChange={(e) => setForm({ ...form, amount_total: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div className="field">
            <label>Split</label>
            <Segmented
              value={form.split_mode}
              options={[
                { key: "full", label: "Completo" },
                { key: "custom", label: "Personalizado" },
              ]}
              onChange={(v) => setForm({ ...form, split_mode: v })}
            />
          </div>
        </div>

        {form.split_mode === "custom" ? (
          <div className="row">
            <div className="field">
              <label htmlFor="p_pct_juan">Juan %</label>
              <input
                id="p_pct_juan"
                inputMode="numeric"
                value={form.split_juan_pct}
                onChange={(e) => {
                  const n = clampPct(Number((e.target.value || "0").replace(/[^\d]/g, "")));
                  setForm((f) => ({ ...f, split_juan_pct: String(n), split_kenia_pct: String(100 - n) }));
                }}
                placeholder="60"
              />
            </div>
            <div className="field">
              <label htmlFor="p_pct_kenia">Kenia %</label>
              <input
                id="p_pct_kenia"
                inputMode="numeric"
                value={form.split_kenia_pct}
                onChange={(e) => {
                  const n = clampPct(Number((e.target.value || "0").replace(/[^\d]/g, "")));
                  setForm((f) => ({ ...f, split_kenia_pct: String(n), split_juan_pct: String(100 - n) }));
                }}
                placeholder="40"
              />
            </div>
          </div>
        ) : null}

        <div className="row">
          <div className="field">
            <label>MSI</label>
            <Segmented
              value={form.is_msi}
              options={[
                { key: "false", label: "No" },
                { key: "true", label: "Sí" },
              ]}
              onChange={(v) => setForm({ ...form, is_msi: v })}
            />
          </div>
          <div className="field">
            <label htmlFor="p_msi_months">Meses</label>
            <input
              id="p_msi_months"
              inputMode="numeric"
              value={form.msi_months}
              onChange={(e) => setForm({ ...form, msi_months: e.target.value })}
              placeholder="12"
              disabled={form.is_msi !== "true"}
            />
          </div>
        </div>

        <div className="actions">
          <button className="btn" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </button>
          <button
            className="btn primary"
            onClick={create}
            disabled={loading || !form.description || !form.store || !form.amount_total}
          >
            {loading ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

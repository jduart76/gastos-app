import React from "react";
import { api } from "../api";
import type { Purchase } from "../types";
import { Table } from "../components/Table";
import { Modal } from "../components/Modal";
import { Segmented } from "../components/Segmented";
import { Loading } from "../components/Loading";

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
    split_mode: "full",
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
    const payload = {
      purchase_date: form.purchase_date,
      description: form.description,
      store: form.store,
      amount_total: Number(form.amount_total),
      is_msi: form.is_msi === "true",
      msi_months: form.is_msi === "true" ? Number(form.msi_months || 0) : null,
      start_month: form.start_month,
      split_mode: form.split_mode,
    };

    try {
      setErr(null);
      setLoading(true);
      await api.createPurchase(payload);
      setOpen(false);
      setForm({ ...form, description: "", store: "", amount_total: "", msi_months: "" });
      await load();
    } catch (e: any) {
      setErr("No se pudo guardar la compra.");
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

      {/* ✅ Loader para la tabla */}
      {loading ? (
        <Loading label="Cargando compras…" />
      ) : (
        <Table
          rows={rows}
          cols={[
            { key: "purchase_date", label: "Fecha" },
            { key: "store", label: "Tienda" },
            { key: "description", label: "Descripción" },

            // ✅ Primer pago (solo si es MSI)
            {
              key: "start_month",
              label: "Primer pago",
              mono: true,
              render: (r) => (r.is_msi ? r.start_month : "—"),
            },

            // ✅ MSI Sí/No
            {
              key: "is_msi",
              label: "MSI",
              render: (r) => (r.is_msi ? <span className="chip ok">Sí</span> : <span className="chip">No</span>),
            },

            // ✅ Cuántos MSI
            {
              key: "msi_months",
              label: "# MSI",
              mono: true,
              render: (r) => (r.is_msi ? String(r.msi_months ?? "") : "—"),
            },

            { key: "amount_total", label: "Total", mono: true, render: (r) => `$${r.amount_total.toFixed(2)}` },
            { key: "monthly_amount", label: "Mensual", mono: true, render: (r) => `$${r.monthly_amount.toFixed(2)}` },

            // ✅ Pago individual si split 50/50
            {
              key: "split_mode",
              label: "Juan (50/50)",
              mono: true,
              render: (r) => (r.split_mode === "half" ? `$${(r.monthly_amount / 2).toFixed(2)}` : "—"),
            },
            {
              key: "split_mode",
              label: "Kenia (50/50)",
              mono: true,
              render: (r) => (r.split_mode === "half" ? `$${(r.monthly_amount / 2).toFixed(2)}` : "—"),
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
            <label htmlFor="pd">Fecha</label>
            <input
              id="pd"
              type="date"
              value={form.purchase_date}
              onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="sm">Mes inicio (YYYY-MM)</label>
            <input
              id="sm"
              value={form.start_month}
              onChange={(e) => setForm({ ...form, start_month: e.target.value })}
              placeholder="2026-01"
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="st">Tienda</label>
          <input
            id="st"
            value={form.store}
            onChange={(e) => setForm({ ...form, store: e.target.value })}
            placeholder="Costco, Amazon, etc."
          />
        </div>

        <div className="field">
          <label htmlFor="ds">Descripción</label>
          <input
            id="ds"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Ej. despensa, refacción..."
          />
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor="amt">Monto total</label>
            <input
              id="amt"
              inputMode="decimal"
              value={form.amount_total}
              onChange={(e) => setForm({ ...form, amount_total: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div className="field">
            <label>Split (expectativa)</label>
            <Segmented
              value={form.split_mode}
              options={[
                { key: "full", label: "Completo" },
                { key: "half", label: "50/50" },
              ]}
              onChange={(v) => setForm({ ...form, split_mode: v })}
            />
          </div>
        </div>

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
            <label htmlFor="msi">Meses</label>
            <input
              id="msi"
              inputMode="numeric"
              value={form.msi_months}
              onChange={(e) => setForm({ ...form, msi_months: e.target.value })}
              placeholder="Ej. 12"
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

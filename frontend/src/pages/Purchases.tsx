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

function fmtMoney(n: number) {
  const x = Number.isFinite(n) ? n : 0;
  return `$${x.toFixed(2)}`;
}

function pctJuan(r: Purchase): number | null {
  if (r.split_mode === "custom") return r.split_juan_pct ?? 0;
  if (r.split_mode === "half") return 50;
  return null; // full (no split)
}

function pctKenia(r: Purchase): number | null {
  if (r.split_mode === "custom") return r.split_kenia_pct ?? 0;
  if (r.split_mode === "half") return 50;
  return null; // full (no split)
}

/**
 * Estos campos deben venir del backend en GET /api/purchases:
 *   paid_juan, paid_kenia  (números)
 * Si no vienen, se mostrarán como 0.00.
 */
function paidJuan(r: Purchase): number {
  return Number((r as any).paid_juan ?? 0) || 0;
}
function paidKenia(r: Purchase): number {
  return Number((r as any).paid_kenia ?? 0) || 0;
}

function isClosed(r: Purchase) {
  return (r.pending ?? 0) <= 0.005;
}

// CSV helpers
function csvEscape(v: unknown) {
  const s = String(v ?? "");
  // escape quotes by doubling them
  const escaped = s.replace(/"/g, '""');
  // wrap if contains comma, quote, or newline
  if (/[",\n\r]/.test(escaped)) return `"${escaped}"`;
  return escaped;
}

function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function PurchasesPage(props: { onOpenPurchase: (id: number) => void }) {
  const [rows, setRows] = React.useState<Purchase[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  // ✅ filtros
  const [statusFilter, setStatusFilter] = React.useState<"all" | "open" | "closed">("all");
  const [q, setQ] = React.useState(""); // búsqueda en tienda + descripción

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

  // ✅ orden default + filtros
  const filteredRows = React.useMemo(() => {
    const query = q.trim().toLowerCase();

    return [...rows]
      // fecha desc (ISO YYYY-MM-DD => localeCompare funciona perfecto)
      .sort((a, b) => String(b.purchase_date).localeCompare(String(a.purchase_date)))
      .filter((r) => {
        if (statusFilter === "open") return !isClosed(r);
        if (statusFilter === "closed") return isClosed(r);
        return true;
      })
      .filter((r) => {
        if (!query) return true;
        const hay = `${r.store ?? ""} ${r.description ?? ""}`.toLowerCase();
        return hay.includes(query);
      });
  }, [rows, statusFilter, q]);

  function exportCsv() {
    // Exporta lo que está filtrado (lo que ves)
    const data = filteredRows;

    const headers = [
      "Fecha",
      "Tienda",
      "Descripción",
      "PrimerPago(YYYY-MM)",
      "MSI",
      "MSI_Meses",
      "Total",
      "Mensual",

      "Juan_Pagado",
      "Juan_PorPagar",
      "Juan_%",

      "Kenia_Pagado",
      "Kenia_PorPagar",
      "Kenia_%",

      "PendienteTotal",
      "Estado",
    ];

    const lines: string[] = [];
    lines.push(headers.map(csvEscape).join(","));

    for (const r of data) {
      const juanPct = pctJuan(r);
      const keniaPct = pctKenia(r);

      const juanShare = juanPct == null ? 0 : (r.amount_total * juanPct) / 100;
      const keniaShare = keniaPct == null ? 0 : (r.amount_total * keniaPct) / 100;

      const juanPorPagar = juanPct == null ? "" : Math.max(juanShare - paidJuan(r), 0).toFixed(2);
      const keniaPorPagar = keniaPct == null ? "" : Math.max(keniaShare - paidKenia(r), 0).toFixed(2);

      const row = [
        r.purchase_date,
        r.store,
        r.description,
        r.is_msi ? (r.start_month ?? "") : "",
        r.is_msi ? "Sí" : "No",
        r.is_msi ? (r.msi_months ?? "") : "",
        r.amount_total.toFixed(2),
        r.monthly_amount.toFixed(2),

        paidJuan(r).toFixed(2),
        juanPorPagar,
        juanPct == null ? "" : String(juanPct),

        paidKenia(r).toFixed(2),
        keniaPorPagar,
        keniaPct == null ? "" : String(keniaPct),

        (r.pending ?? 0).toFixed(2),
        isClosed(r) ? "Cerrada" : "Abierta",
      ];

      lines.push(row.map(csvEscape).join(","));
    }

    const ym = new Date().toISOString().slice(0, 10);
    downloadTextFile(`purchases_${ym}.csv`, lines.join("\n"));
  }

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

        <button className="btn" onClick={exportCsv} disabled={loading || filteredRows.length === 0}>
          ⬇️ Exportar CSV
        </button>

        {loading ? <Loading inline label="Cargando…" /> : null}
        {err ? <span className="chip bad">{err}</span> : null}
      </div>

      {/* ✅ filtros */}
      <div className="row">
        <div className="field">
          <label htmlFor="p_search">Buscar (tienda o descripción)</label>
          <input
            id="p_search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ej. Costco, adoq…, boiler…"
          />
        </div>

        <div className="field">
          <label htmlFor="p_status">Estado</label>
          <select id="p_status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="all">Todas</option>
            <option value="open">Abiertas</option>
            <option value="closed">Cerradas</option>
          </select>
        </div>

        <div className="field" style={{ opacity: 0.85 }}>
          <label>Mostrando</label>
          <div className="small">
            <b>{filteredRows.length}</b> de <b>{rows.length}</b>
          </div>
        </div>
      </div>

      {loading ? (
        <Loading label="Cargando compras…" />
      ) : (
        <Table
          rows={filteredRows}
          cols={[
            { key: "purchase_date", label: "Fecha", mono: true },
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

            { key: "amount_total", label: "Total", mono: true, render: (r) => fmtMoney(r.amount_total) },
            { key: "monthly_amount", label: "Mensual", mono: true, render: (r) => fmtMoney(r.monthly_amount) },

            // ===== JUAN =====
            {
              key: "split_mode",
              label: "Juan (pagado)",
              mono: true,
              render: (r) => fmtMoney(paidJuan(r)),
            },
            {
              key: "split_mode",
              label: "Juan (por pagar)",
              mono: true,
              render: (r) => {
                const pct = pctJuan(r);
                if (pct == null) return "—"; // full: no split
                const share = (r.amount_total * pct) / 100; // total share
                const pending = Math.max(share - paidJuan(r), 0);
                return `${fmtMoney(pending)} (${pct}%)`;
              },
            },

            // ===== KENIA =====
            {
              key: "split_mode",
              label: "Kenia (pagado)",
              mono: true,
              render: (r) => fmtMoney(paidKenia(r)),
            },
            {
              key: "split_mode",
              label: "Kenia (por pagar)",
              mono: true,
              render: (r) => {
                const pct = pctKenia(r);
                if (pct == null) return "—"; // full: no split
                const share = (r.amount_total * pct) / 100; // total share
                const pending = Math.max(share - paidKenia(r), 0);
                return `${fmtMoney(pending)} (${pct}%)`;
              },
            },

            {
              key: "pending",
              label: "Pendiente",
              mono: true,
              render: (r) =>
                isClosed(r) ? <span className="chip ok">Cerrada</span> : <span className="chip bad">${r.pending.toFixed(2)}</span>,
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

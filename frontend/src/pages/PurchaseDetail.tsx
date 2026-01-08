import React from "react";
import { api } from "../api";
import type { Purchase, Payment } from "../types";
import { Table } from "../components/Table";
import { Modal } from "../components/Modal";
import { Segmented } from "../components/Segmented";
import { Loading } from "../components/Loading";

function expectedPct(p: Purchase, who: string): number | null {
  if (p.split_mode === "custom") {
    if (who === "Juan") return p.split_juan_pct ?? 0;
    if (who === "Kenia") return p.split_kenia_pct ?? 0;
    return null;
  }
  if (p.split_mode === "half") return 50;
  return null;
}

export function PurchaseDetailPage(props: { id: number; onBack: () => void }) {
  const [purchase, setPurchase] = React.useState<Purchase | null>(null);
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const [openPay, setOpenPay] = React.useState(false);
  const [split50, setSplit50] = React.useState(false);
  const [splitMode, setSplitMode] = React.useState<"single" | "both">("single");

  const [payForm, setPayForm] = React.useState({
    payment_date: new Date().toISOString().slice(0, 10),
    payer: localStorage.getItem("user") || "Juan",
    amount: "",
    note: "",
  });

  async function load() {
    try {
      setErr(null);
      setLoading(true);
      const res = await api.purchaseDetail(props.id);
      setPurchase(res.purchase);
      setPayments(res.payments);
    } catch (e: any) {
      setErr("No se pudo cargar el detalle.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, [props.id]);

  function suggestedAmount(): number {
    if (!purchase) return 0;
    const base = purchase.monthly_amount;

    // Si marcas split50, sugerimos 50/50 (legacy)
    if (split50) return Math.round((base / 2) * 100) / 100;

    // Si compra tiene split esperado custom/half y el pago es "single", sugerimos la parte del payer
    if (splitMode === "single") {
      const pct = expectedPct(purchase, payForm.payer);
      if (pct != null) {
        return Math.round((base * pct / 100) * 100) / 100;
      }
    }

    return base;
  }

  React.useEffect(() => {
    if (!purchase) return;
    setPayForm((f) => ({ ...f, amount: String(suggestedAmount().toFixed(2)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchase, split50, splitMode, payForm.payer]);

  async function addPayment() {
    if (!purchase) return;
    try {
      setErr(null);
      setLoading(true);
      await api.addPayment({
        purchase_id: purchase.id,
        payment_date: payForm.payment_date,
        payer: payForm.payer,
        amount: Number(payForm.amount),
        note: payForm.note || null,
        split_50: split50,
        split_mode: splitMode,
      });
      setOpenPay(false);
      setPayForm((f) => ({ ...f, note: "" }));
      await load();
    } catch (e: any) {
      setErr(String(e?.message ?? "No se pudo guardar el pago."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      <div className="actions">
        <button className="btn" onClick={props.onBack} disabled={loading}>
          ← Volver
        </button>
        <button className="btn primary" onClick={() => setOpenPay(true)} disabled={!purchase || loading}>
          ➕ Agregar pago
        </button>
        {loading ? <Loading inline label="Cargando…" /> : null}
        {err ? <span className="chip bad">{err}</span> : null}
      </div>

      {loading && !purchase ? (
        <Loading label="Cargando detalle…" />
      ) : purchase ? (
        <>
          <div className="grid">
            <div className="card" style={{ gridColumn: "span 6" }}>
              <div className="label">Compra</div>
              <div className="value">{purchase.store}</div>
              <div className="hint">
                {purchase.description} · {purchase.purchase_date}
                {purchase.is_msi ? ` · Primer pago ${purchase.start_month}` : ""}
              </div>
            </div>

            <div className="card" style={{ gridColumn: "span 3" }}>
              <div className="label">Total</div>
              <div className="value">${purchase.amount_total.toFixed(2)}</div>
              <div className="hint">{purchase.is_msi ? `MSI ${purchase.msi_months}` : "Pago único"}</div>
            </div>

            <div className="card" style={{ gridColumn: "span 3" }}>
              <div className="label">Mensual</div>
              <div className="value">${purchase.monthly_amount.toFixed(2)}</div>
              <div className="hint">
                Split esperado:{" "}
                {purchase.split_mode === "custom"
                  ? `Juan ${purchase.split_juan_pct}% / Kenia ${purchase.split_kenia_pct}%`
                  : purchase.split_mode === "half"
                  ? "50/50"
                  : "—"}
              </div>
            </div>
          </div>

          <Table
            rows={payments}
            cols={[
              { key: "payment_date", label: "Fecha" },
              { key: "payer", label: "Paga" },
              { key: "amount", label: "Monto", mono: true, render: (r) => `$${r.amount.toFixed(2)}` },
              { key: "note", label: "Nota", render: (r) => r.note || "—" },
              {
                key: "split_50",
                label: "Split50",
                render: (r) => (r.split_50 ? <span className="chip ok">Sí</span> : <span className="chip">No</span>),
              },
            ]}
          />
        </>
      ) : null}

      <Modal open={openPay} title="Agregar pago" onClose={() => setOpenPay(false)}>
  <div className="row">
    <div className="field">
      <label htmlFor="d_payment_date">Fecha</label>
      <input
        id="d_payment_date"
        type="date"
        value={payForm.payment_date}
        onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })}
      />
    </div>

          <div className="field">
            <label>Payer</label>
            <Segmented
              value={payForm.payer}
              options={[
                { key: "Juan", label: "Juan" },
                { key: "Kenia", label: "Kenia" },
              ]}
              onChange={(v) => setPayForm({ ...payForm, payer: v })}
            />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label>Modo</label>
            <Segmented
              value={splitMode}
              options={[
                { key: "single", label: "Single" },
                { key: "both", label: "Ambos" },
              ]}
              onChange={(v) => setSplitMode(v as any)}
            />
          </div>

          <div className="field">
            <label>Split 50/50 (legacy)</label>
            <Segmented
              value={split50 ? "true" : "false"}
              options={[
                { key: "false", label: "No" },
                { key: "true", label: "Sí" },
              ]}
              onChange={(v) => setSplit50(v === "true")}
            />
          </div>
        </div>

        <div className="field">
          <label>Monto</label>
          <input
            inputMode="decimal"
            value={payForm.amount}
            onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
            placeholder="0.00"
          />
          <div className="hint">Sugerido según mensualidad y split esperado.</div>
        </div>

        <div className="field">
    <label htmlFor="d_note">Nota</label>
    <input
      id="d_note"
      value={payForm.note}
      onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
      placeholder="Opcional"
    />
  </div>

        <div className="actions">
          <button className="btn" onClick={() => setOpenPay(false)} disabled={loading}>
            Cancelar
          </button>
          <button className="btn primary" onClick={addPayment} disabled={loading || !payForm.amount}>
            {loading ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

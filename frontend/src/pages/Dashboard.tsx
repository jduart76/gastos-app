import React from "react";
import { api } from "../api";
import { Card } from "../components/Card";
import { Loading } from "../components/Loading";
import type { Dashboard } from "../types";

function yyyyMmToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function supportsMonthInput(): boolean {
  const i = document.createElement("input");
  i.setAttribute("type", "month");
  return i.type === "month";
}

export function DashboardPage() {
  const [month, setMonth] = React.useState(yyyyMmToday());
  const [data, setData] = React.useState<Dashboard | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const supportsMonth = supportsMonthInput();

  async function load(m: string) {
    try {
      setErr(null);
      setLoading(true);
      const res = await api.dashboard(m);
      setData(res);
    } catch (e: any) {
      setErr("No se pudo cargar dashboard (revisa backend/API base).");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load(month);
  }, [month]);

  return (
    <div className="shell">
      <div className="actions">
        <div className="field" style={{ maxWidth: 220, margin: 0 }}>
          <label className="field-label">Mes</label>
          <input
            className="field-input"
            type={supportsMonth ? "month" : "text"}
            placeholder={supportsMonth ? undefined : "YYYY-MM"}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>

        {loading ? <Loading inline label="Cargando…" /> : null}
      </div>

      {err ? (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="chip bad">{err}</span>
          <button className="btn" onClick={() => load(month)} disabled={loading}>
            Reintentar
          </button>
        </div>
      ) : null}

      {/* ✅ Loader global del dashboard */}
      {loading && !data ? (
        <div style={{ marginTop: 12 }}>
          <Loading label="Cargando dashboard…" />
        </div>
      ) : (
        <>
          <div className="grid">
            <Card
              label="Saldo pendiente total"
              value={data ? `$${data.total_pending}` : "—"}
              hint="Suma de compras abiertas (saldo > 0)."
            />
            <Card
              label="Por pagar este mes"
              value={data ? `$${data.total_due_this_month}` : "—"}
              hint="Considera lo ya pagado en el mes."
            />
            <Card
              label="Por pagar el próximo mes"
              value={data ? `$${data.total_due_next_month}` : "—"}
              hint={`Estimación para ${data?.next_month ?? "—"}`}
            />
          </div>

          <div className="grid">
            <div className="card" style={{ gridColumn: "span 12" }}>
              <div className="label">Resumen</div>
              <div className="value">{data ? `${data.open_count} compras abiertas` : "—"}</div>
              <div className="hint">Tip: cuando el saldo pendiente llega a $0, la compra se considera cerrada.</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import React from "react";
import { api } from "../api";
import { Card } from "../components/Card";
import type { Dashboard } from "../types";

function yyyyMmToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

export function DashboardPage() {
  const [month, setMonth] = React.useState(yyyyMmToday());
  const [data, setData] = React.useState<Dashboard | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const supportsMonth = (() => {
  const i = document.createElement("input");
  i.setAttribute("type", "month");
  return i.type === "month";
})();

  React.useEffect(()=>{
    (async()=>{
      try{
        setErr(null);
        const res = await api.dashboard(month);
        setData(res);
      }catch(e:any){
        setErr("No se pudo cargar dashboard (revisa backend/API base).");
      }
    })();
  }, [month]);

  return (
    <div className="shell">
      <div className="actions">
        <div className="field" style={{maxWidth:220, margin:0}}>
          <label className="field-label">Mes</label>
            <input
                className="field-input"
                type={supportsMonth ? "month" : "text"}
                placeholder={supportsMonth ? undefined : "YYYY-MM"}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
            />
        </div>
      </div>

      {err ? <div className="chip bad" style={{marginTop:12}}>{err}</div> : null}

      <div className="grid">
        <Card label="Saldo pendiente total" value={data ? `$${data.total_pending}` : "—"} hint="Suma de compras abiertas (saldo > 0)." />
        <Card label="Por pagar este mes" value={data ? `$${data.total_due_this_month}` : "—"} hint="Considera lo ya pagado en el mes." />
        <Card label="Por pagar el próximo mes" value={data ? `$${data.total_due_next_month}` : "—"} hint={`Estimación para ${data?.next_month ?? "—"}`} />
      </div>

      <div className="grid">
        <div className="card" style={{gridColumn:"span 12"}}>
          <div className="label">Resumen</div>
          <div className="value">{data ? `${data.open_count} compras abiertas` : "—"}</div>
          <div className="hint">Tip: cuando el saldo pendiente llega a $0, la compra se considera cerrada.</div>
        </div>
      </div>
    </div>
  );
}

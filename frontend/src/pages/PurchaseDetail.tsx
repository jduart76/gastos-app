import React from "react";
import { api } from "../api";
import type { Purchase, Payment } from "../types";
import { Table } from "../components/Table";
import { Modal } from "../components/Modal";
import { Segmented } from "../components/Segmented";

export function PurchaseDetailPage(props: { id: number; onBack: ()=>void }) {
  const [purchase, setPurchase] = React.useState<Purchase | null>(null);
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  const [openPay, setOpenPay] = React.useState(false);
  const [split50, setSplit50] = React.useState(false);
  const [splitMode, setSplitMode] = React.useState<"single"|"both">("single");

  const [payForm, setPayForm] = React.useState({
    payment_date: new Date().toISOString().slice(0,10),
    payer: localStorage.getItem("user") || "Juan",
    amount: "",
    note: "",
  });

  async function load() {
    try{
      setErr(null);
      const res = await api.purchaseDetail(props.id);
      setPurchase(res.purchase);
      setPayments(res.payments);
    }catch(e:any){
      setErr("No se pudo cargar el detalle.");
    }
  }

  React.useEffect(()=>{ load(); }, [props.id]);

  function suggestedAmount(): number {
    if (!purchase) return 0;
    const base = purchase.monthly_amount;
    return split50 ? Math.round((base/2)*100)/100 : base;
  }

  React.useEffect(()=>{
    if (!purchase) return;
    setPayForm(f=>({ ...f, amount: String(suggestedAmount().toFixed(2)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchase, split50]);

  async function addPayment() {
    await api.addPayment({
      purchase_id: props.id,
      payment_date: payForm.payment_date,
      payer: payForm.payer,
      amount: Number(payForm.amount),
      note: payForm.note || null,
      split_50: split50,
      split_mode: split50 ? splitMode : "single"
    });
    setOpenPay(false);
    setPayForm({ payment_date: new Date().toISOString().slice(0,10), payer: payForm.payer, amount: "", note: "" });
    await load();
  }

  async function delPayment(pid: number) {
    if (!confirm("¿Borrar pago?")) return;
    await api.deletePayment(pid);
    await load();
  }

  return (
    <div className="shell">
      <div className="actions">
        <button className="btn" onClick={props.onBack}>← Volver</button>
        <button className="btn primary" onClick={()=>setOpenPay(true)}>💳 Agregar pago</button>
        {err ? <span className="chip bad">{err}</span> : null}
      </div>

      {purchase ? (
        <div className="grid">
            <div className="card" style={{gridColumn:"span 6"}}>
                <div className="label">Compra</div>
                <div className="value">{purchase.store}</div>
                <div className="hint">
                {purchase.description} · {purchase.purchase_date}
            {purchase.start_month ? ` · Primer pago ${purchase.start_month}` : ""}
            </div>
        </div>
          <div className="card" style={{gridColumn:"span 3"}}>
            <div className="label">Total</div>
            <div className="value">${purchase.amount_total.toFixed(2)}</div>
            <div className="hint">{purchase.is_msi ? `MSI ${purchase.msi_months}m` : "Una sola vez"}</div>
          </div>
          <div className="card" style={{gridColumn:"span 3"}}>
            <div className="label">Pendiente</div>
            <div className="value">${purchase.pending.toFixed(2)}</div>
            <div className="hint">{purchase.pending<=0.005 ? <span className="chip ok">Cerrada</span> : <span className="chip bad">Abierta</span>}</div>
          </div>
        </div>
      ) : null}

      <Table
        rows={payments}
        cols={[
          { key:"payment_date", label:"Fecha" },
          { key:"payer", label:"Payer" },
          { key:"amount", label:"Monto", mono:true, render:(r)=>`$${r.amount.toFixed(2)}` },
          { key:"split_50", label:"Split", render:(r)=> r.split_50 ? "50/50" : "" },
          { key:"note", label:"Nota", render:(r)=> r.note ?? "" }
        ]}
        onRowClick={(r)=>delPayment(r.id)}
      />

      <div className="small" style={{marginTop:10}}>Tip: toca un pago para borrarlo (luego lo cambiamos a “Editar/Borrar”).</div>

      <Modal open={openPay} title="Agregar pago" onClose={()=>setOpenPay(false)}>
        <div className="row">
          <div className="field">
            <label htmlFor="pdate">Fecha</label>
            <input id="pdate" type="date" value={payForm.payment_date} onChange={(e)=>setPayForm({...payForm, payment_date:e.target.value})}/>
          </div>
          <div className="field">
            <label htmlFor="payer">Quién pagó</label>
            <input id="payer" value={payForm.payer} onChange={(e)=>setPayForm({...payForm, payer:e.target.value})} />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor="amount">Monto</label>
            <input id="amount" inputMode="decimal" value={payForm.amount} onChange={(e)=>setPayForm({...payForm, amount:e.target.value})} placeholder="0.00" />
            <div className="small">Sugerido: ${purchase ? purchase.monthly_amount.toFixed(2) : "—"}</div>
          </div>
          <div className="field">
            <label>Dividir 50/50</label>
            <Segmented
              value={split50 ? "yes" : "no"}
              options={[{key:"no",label:"No"},{key:"yes",label:"Sí"}]}
              onChange={(v)=>setSplit50(v==="yes")}
            />
          </div>
        </div>

        {split50 ? (
          <div className="field">
            <label>Modo split</label>
            <Segmented
              value={splitMode}
              options={[{key:"single",label:"Solo este pago"},{key:"both",label:"Registrar Juan+Kenia"}]}
              onChange={(v)=>setSplitMode(v as any)}
            />
            <div className="small">
              “Registrar Juan+Kenia” crea 2 pagos con el mismo monto (mitad y mitad).
            </div>
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="note">Nota</label>
          <input id="note" value={payForm.note} onChange={(e)=>setPayForm({...payForm, note:e.target.value})} placeholder="Opcional" />
        </div>

        <div className="actions">
          <button className="btn" onClick={()=>setOpenPay(false)}>Cancelar</button>
          <button className="btn primary" onClick={addPayment} disabled={!payForm.amount}>
            Guardar pago
          </button>
        </div>
      </Modal>
    </div>
  );
}

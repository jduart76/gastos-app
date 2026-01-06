import React from "react";

export function TopBar(props: { user: string | null; onNav: (p: string)=>void; onLogout: ()=>void }) {
  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <div className="title">Gastos</div>
          <div className="sub">Estilo iPhone · compras, MSI y pagos</div>
        </div>

        <div style={{display:"flex", gap:10, alignItems:"center"}}>
          <button className="pill" onClick={()=>props.onNav("dashboard")}>Dashboard</button>
          <button className="pill" onClick={()=>props.onNav("purchases")}>Compras</button>
          <span className="chip">{props.user ? `👤 ${props.user}` : "—"}</span>
          <button className="pill" onClick={props.onLogout}>Salir</button>
        </div>
      </div>
    </div>
  );
}

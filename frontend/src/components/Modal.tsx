import React from "react";

export function Modal(props: { open: boolean; title: string; onClose: ()=>void; children: React.ReactNode }) {
  if (!props.open) return null;
  return (
    <div className="modalBackdrop" onClick={props.onClose}>
      <div className="modal" onClick={(e)=>e.stopPropagation()}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:10}}>
          <h2 style={{margin:0}}>{props.title}</h2>
          <button className="btn" onClick={props.onClose}>Cerrar</button>
        </div>
        <div style={{marginTop:10}}>{props.children}</div>
      </div>
    </div>
  );
}

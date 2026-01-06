import React from "react";

export function Card(props: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <div className="label">{props.label}</div>
      <div className="value">{props.value}</div>
      {props.hint ? <div className="hint">{props.hint}</div> : null}
    </div>
  );
}

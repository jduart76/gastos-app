import React from "react";

export function Segmented(props: { value: string; options: {key: string; label: string}[]; onChange: (v:string)=>void }) {
  return (
    <div className="segment">
      {props.options.map(o=>(
        <button
          key={o.key}
          className={props.value===o.key ? "active" : ""}
          onClick={()=>props.onChange(o.key)}
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

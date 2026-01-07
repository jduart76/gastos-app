import React from "react";

export function Loading(props: { label?: string; inline?: boolean }) {
  return (
    <div className={props.inline ? "loadingInline" : "loadingBlock"} role="status" aria-live="polite">
      <div className="spinner" />
      {props.label ? <div className="loadingLabel">{props.label}</div> : null}
    </div>
  );
}

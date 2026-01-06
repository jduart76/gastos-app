import React from "react";

type Col<T> = { key: keyof T; label: string; render?: (row:T)=>React.ReactNode; mono?: boolean };

export function Table<T extends Record<string, any>>(props: {
  rows: T[];
  cols: Col<T>[];
  onRowClick?: (row:T)=>void;
}) {
  const [sortKey, setSortKey] = React.useState<string>("");
  const [sortDir, setSortDir] = React.useState<1|-1>(1);

  const sorted = React.useMemo(()=>{
    const rows = [...props.rows];
    if (!sortKey) return rows;
    rows.sort((a,b)=>{
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return -1 * sortDir;
      if (bv == null) return 1 * sortDir;

      // numeric
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sortDir;
      // date-ish string or normal string
      return String(av).localeCompare(String(bv)) * sortDir;
    });
    return rows;
  }, [props.rows, sortKey, sortDir]);

  function toggleSort(k: string) {
    if (sortKey === k) setSortDir(sortDir === 1 ? -1 : 1);
    else { setSortKey(k); setSortDir(1); }
  }

  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            {props.cols.map(c=>(
              <th key={String(c.key)} onClick={()=>toggleSort(String(c.key))}>
                {c.label}{sortKey===String(c.key) ? (sortDir===1 ? " ▲" : " ▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, idx)=>(
            <tr key={idx} onClick={()=>props.onRowClick?.(r)} style={{cursor: props.onRowClick ? "pointer":"default"}}>
              {props.cols.map(c=>(
                <td key={String(c.key)} className={c.mono ? "mono" : ""}>
                  {c.render ? c.render(r) : String(r[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
          {sorted.length===0 ? (
            <tr><td colSpan={props.cols.length}><span className="small">Sin registros.</span></td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
